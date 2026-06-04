import { useEffect, useState } from "react";

// 后台补抓「鸟种明细」的实时进度条。轮询 /data/scrape_status.json（由
// data/process/scrape_status.py 每 ~15s 重写）。验证码是自动换会话重试的，
// 不需要人工解 —— 所以卡住时显示「stalled」提醒，而不是「请解验证码」。
export default function ScrapeStatus() {
  const [s, setS] = useState(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/data/scrape_status.json", { cache: "no-store" });
        if (r.ok && alive) setS(await r.json());
      } catch {
        /* 没有进度文件就不显示 */
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!s || (!s.running && !s.stalled && !s.done)) return null;
  const pct = s.target_total ? Math.round((s.have_total / s.target_total) * 100) : 0;
  const cls = "scrape" + (s.stalled ? " stalled" : s.done ? " done" : "");

  return (
    <div className={cls}>
      <div className="srow">
        <b>
          {s.stalled
            ? "⚠ 鸟种明细补抓卡住了"
            : s.done
            ? "✓ 鸟种明细补抓完成"
            : "⟳ 鸟种明细补抓中"}
        </b>
        <span className="snum">
          {s.have_total}/{s.target_total}（{pct}%）
        </span>
      </div>
      <div className="sbar">
        <i style={{ width: pct + "%" }} />
      </div>
      <div className="snote">
        {s.stalled
          ? `连续撞验证码或约 ${Math.round(s.idle_seconds / 60)} 分钟无进展。验证码是自动换会话重试的、不需要你手动解；若长时间卡住多半是网络被限，可换网络或稍后重试。`
          : s.done
          ? "明细已抓全。导入并重新导出后，频率会更准、白马雪山等空清单会补上。"
          : `本轮 ${s.session_fetched}/${s.session_todo} · 自动跳过验证码 ${s.captcha_events} 次（无需手动解）· ${s.updated_at} 更新`}
      </div>
    </div>
  );
}
