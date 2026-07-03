"""
BirdTrace Agent Harness
========================
用 Claude Agent SDK 搭建的多角色协作流水线,包含四个子 agent:

    product  产品规划  —— 把一句话需求扩展成详细 spec(不写代码、不做视觉设计)
    design   产品设计  —— 基于 spec 给出交互/视觉方向(方向性建议,不是像素级设计稿)
    coder    编码实现  —— 基于 spec + 设计说明实现功能代码
    tester   测试评审  —— 独立检查实现是否满足验收标准,不自我评分

设计原则(参考 Anthropic 自己的长任务 harness 实践):
    1. 生成和评估分离 —— tester 永远是独立的 agent,不能是 coder 自己
    2. 子 agent 之间只通过文件通信 —— 每个阶段的产出写入 birdtrace_workspace/*.md,
       下一个 agent 从文件里读,而不是依赖对话历史(子 agent 的上下文是全新的)
    3. product / design 的产出建议你先人工过一遍再继续 —— 这两类是判断型工作,
       agent 给的是草稿,不是拍板结果
    4. 每个 agent 的工具集尽量窄,权限最小化(tester 没有 Write/Edit 权限,
       防止它在"验收"的同时悄悄改代码掩盖问题)

用法:
    python agent.py "给 BirdTrace 加一个功能:按标签筛选历史观鸟记录"

    # 只跑到 product 阶段,自己看完 spec 再决定要不要继续
    python agent.py --stage product "给 BirdTrace 加一个功能:..."
"""

import asyncio
import sys
import argparse
from pathlib import Path

from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    AgentDefinition,
    ToolUseBlock,
)

WORKSPACE = Path("./birdtrace_workspace")
WORKSPACE.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# 子 agent 定义
# ---------------------------------------------------------------------------

AGENTS = {
    "product": AgentDefinition(
        description=(
            "产品规划专家。用于把一句话/几句话的需求扩展成详细的产品 spec,"
            "包括用户故事、功能范围、边界情况、验收标准。不写代码,不做视觉设计。"
        ),
        prompt=(
            "你是 BirdTrace 的产品经理。把用户给的需求扩展成一份详细、可执行的产品 spec,"
            "写入 birdtrace_workspace/product_spec.md。\n\n"
            "spec 需要包含:\n"
            "- 功能目标(为什么要做这个)\n"
            "- 核心用户故事\n"
            "- MVP 范围,明确写出'本次不做什么'\n"
            "- 边界情况 / 异常情况\n"
            "- 验收标准(要具体到可以被 tester agent 直接拿去核对)\n\n"
            "不要写代码,不要做具体 UI 设计。保持 spec 简洁——过度指定细节会导致"
            "下游实现按你的假设走偏,而不是按用户真实需求走。"
        ),
        tools=["Read", "Write", "Glob"],
        model="sonnet",
    ),
    "design": AgentDefinition(
        description=(
            "产品设计专家。基于产品 spec 给出 UI/交互方向,包括页面结构、关键交互流程、"
            "组件清单、视觉风格建议。用于涉及界面/交互的任务。"
        ),
        prompt=(
            "你是 BirdTrace 的产品设计师。读取 birdtrace_workspace/product_spec.md,"
            "产出一份设计说明,写入 birdtrace_workspace/design_spec.md。\n\n"
            "内容包括:\n"
            "- 涉及的页面/屏幕结构\n"
            "- 关键交互流程(用户从哪进入、怎么操作、结果如何呈现)\n"
            "- 需要的组件清单\n"
            "- 视觉风格方向性建议(不需要精确的色值/像素级设计稿)\n\n"
            "给方向,不做最终视觉决策——那部分留给人来定。"
        ),
        tools=["Read", "Write", "Glob"],
        model="sonnet",
    ),
    "coder": AgentDefinition(
        description=(
            "编码专家。基于产品 spec 和设计说明实现具体功能代码。用于所有代码编写、"
            "修改、重构任务。"
        ),
        prompt=(
            "你是 BirdTrace 的工程师。读取 birdtrace_workspace/product_spec.md,"
            "如果存在也读取 birdtrace_workspace/design_spec.md,然后实现对应功能。\n\n"
            "要求:\n"
            "- 代码要有清晰的类型标注和必要注释,注释解释'为什么这么做'而不是复述代码\n"
            "- 不写占位符/stub 实现,每一部分都要完整可运行\n"
            "- 如果 spec 有歧义,做出合理假设并在实现笔记里写清楚假设内容,而不是卡住不动\n\n"
            "完成后把改动摘要(改了哪些文件、做了什么、遗留了什么假设)写入 "
            "birdtrace_workspace/implementation_notes.md,供 tester agent 和你自己参考。"
        ),
        tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        model="opus",
    ),
    "tester": AgentDefinition(
        description=(
            "测试与质量评审专家。检查代码实现是否满足产品 spec 的验收标准,运行测试,"
            "给出具体可执行的反馈。用于所有验收、QA、代码评审任务。"
        ),
        prompt=(
            "你是 BirdTrace 的 QA 工程师,独立于写代码的人。\n\n"
            "读取 birdtrace_workspace/product_spec.md 里的验收标准和 "
            "birdtrace_workspace/implementation_notes.md,检查最新代码实现是否满足要求。"
            "运行现有测试(如果有),针对新功能编写并运行必要的测试。"
            "尽量像真实用户一样实际操作/调用功能来验证行为,而不是只读代码猜测结果。\n\n"
            "把结果写入 birdtrace_workspace/qa_report.md,明确列出:\n"
            "- 通过项\n"
            "- 失败项(附具体复现步骤)\n"
            "- 你的整体判断:是否可以合入\n\n"
            "对自己发现的问题保持挑剔——不要因为代码'看起来合理'就判定通过。"
            "你没有代码写权限,只能读和运行,这是故意的:你的任务是发现问题,不是顺手修掉它们。"
        ),
        tools=["Read", "Bash", "Glob", "Grep"],
        model="sonnet",
    ),
}


ORCHESTRATOR_PROMPT = """你是 BirdTrace 项目的协调者,手上有四个专精子 agent:
product(产品规划)、design(产品设计)、coder(编码实现)、tester(测试评审)。

标准流程:
1. 调用 product agent,把用户需求转化成 spec
2. 如果任务涉及界面/交互,调用 design agent
3. 调用 coder agent 实现功能
4. 调用 tester agent 验收;如果测试不通过,把具体反馈原样传给 coder agent 修复,
   重复 3-4 直到通过,或者连续两次修复都不能解决同一个问题(此时停下来,把情况汇报给用户,
   不要无限重试)

规则:
- 不要跳过某个 agent 自己动手写代码或做设计判断——按顺序委派,保持职责边界清晰
- 每个阶段完成后,用一两句话向用户汇报进展,而不是转述子 agent 的完整输出
- product 和 design 阶段完成后,如果用户是交互式运行(没有传 --stage 参数强制单阶段),
  可以直接继续;但要在汇报里明确指出"这是草稿,过一遍再确认"
"""


# ---------------------------------------------------------------------------
# 运行逻辑
# ---------------------------------------------------------------------------

async def run_pipeline(user_request: str, only_stage: str | None = None):
    if only_stage:
        # 单阶段模式:只调用某一个子 agent,方便你分步审查
        if only_stage not in AGENTS:
            print(f"未知阶段: {only_stage}。可选: {list(AGENTS.keys())}")
            return
        prompt = f"使用 {only_stage} agent 处理以下需求:{user_request}"
        allowed = ["Read", "Write", "Glob", "Agent"]
    else:
        prompt = user_request
        allowed = ["Read", "Write", "Glob", "Agent"]

    options = ClaudeAgentOptions(
        system_prompt=ORCHESTRATOR_PROMPT,
        allowed_tools=allowed,
        agents=AGENTS,
        permission_mode="acceptEdits",
        max_turns=60,
        max_budget_usd=3.0,   # 安全阀:防止意外跑出天价账单,按需调整
        cwd=str(WORKSPACE.parent),
    )

    async for message in query(prompt=prompt, options=options):
        # 打印子 agent 委派事件
        if hasattr(message, "content") and message.content:
            for block in message.content:
                if isinstance(block, ToolUseBlock) and block.name in ("Task", "Agent"):
                    subagent = block.input.get("subagent_type", "unknown")
                    print(f"\n🔧 委派给子 agent: {subagent}")

        # 最终结果
        if hasattr(message, "result"):
            print("\n=== 本轮结果 ===")
            print(message.result)

        # 成本追踪
        if hasattr(message, "total_cost_usd"):
            print(f"\n💰 本次运行花费: ${message.total_cost_usd:.4f}")


def main():
    parser = argparse.ArgumentParser(description="BirdTrace multi-agent harness")
    parser.add_argument("request", nargs="*", help="需求描述")
    parser.add_argument(
        "--stage",
        choices=list(AGENTS.keys()),
        default=None,
        help="只跑单个阶段(product/design/coder/tester),不走完整流水线",
    )
    args = parser.parse_args()

    request = " ".join(args.request) or (
        "给 BirdTrace 加一个功能:用户可以给单次观鸟记录打标签"
        "(比如'林鸟'、'水鸟'),并按标签筛选历史记录。"
    )

    asyncio.run(run_pipeline(request, only_stage=args.stage))


if __name__ == "__main__":
    main()
