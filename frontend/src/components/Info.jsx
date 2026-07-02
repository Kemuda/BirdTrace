// 通用 ⓘ 提示：图标默认极小；hover / focus / tap 时把 children 弹出来。
// 对外版把"频率怎么算""怎么读"这类长解释藏到这里，第一眼干净。
import { useEffect, useRef, useState } from "react";

export default function Info({ children, label = "详细说明", side = "right" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // 手机端点开外面自动关掉
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  return (
    <span
      className={"info-wrap" + (open ? " open" : "")}
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-btn"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⓘ
      </button>
      <span className={"info-pop info-pop--" + side} role="tooltip">
        {children}
      </span>
    </span>
  );
}
