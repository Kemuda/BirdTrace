// 统一三槽查询条：地点 / 时间 / 鸟种。留空的那一槽 = 本页答案（高亮）。
// 每槽传入 node（自定义控件如 <select>）或字符串；answer 指明哪一槽是答案。
function Slot({ lab, children, isAnswer }) {
  return (
    <div className={"slot" + (isAnswer ? " answer" : "")}>
      <div className="lab">{lab}</div>
      {isAnswer ? (
        <div className="ans">＝ 本页答案</div>
      ) : (
        <div className="val">{children}</div>
      )}
    </div>
  );
}

export default function QueryBar({ where, when, what, answer }) {
  return (
    <div className="qbar">
      <Slot lab="📍 地点" isAnswer={answer === "where"}>{where}</Slot>
      <Slot lab="📅 时间" isAnswer={answer === "when"}>{when}</Slot>
      <Slot lab="🐦 鸟种" isAnswer={answer === "what"}>{what}</Slot>
    </div>
  );
}
