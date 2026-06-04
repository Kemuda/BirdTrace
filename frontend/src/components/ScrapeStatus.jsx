import { useEffect, useRef, useState } from "react";

// 后台补抓「鸟种明细」的实时进度条。轮询 /data/scrape_status.json（由
// data/process/scrape_status.py 每 ~15s 重写）。验证码是自动换会话重试的，
// 不需要人工解 —— 所以卡住时显示「stalled」提醒，而不是「请解验证码」。
// 卡住时（false→true）播一声红角鸮叫（Otus sunia，Wikimedia Commons 公有领域）。
export default function ScrapeStatus() {
  const [s, setS] = useState(null);
  const audioRef = useRef(null);
  const playedRef = useRef(false); // 同一次 stall 只叫一次，恢复后重置

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

  function hoot() {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {
      /* 浏览器可能因无用户手势拦截自动播放 —— 卡住条上的 🔊 可手动补放 */
    });
  }

  // 进入 stalled 时叫一声；恢复（不再 stalled）后重置，下次再卡会再叫
  useEffect(() => {
    if (s?.stalled) {
      if (!playedRef.current) {
        playedRef.current = true;
        hoot();
      }
    } else {
      playedRef.current = false;
    }
  }, [s?.stalled]);

  if (!s || (!s.running && !s.stalled && !s.done)) return null;
  const pct = s.target_total ? Math.round((s.have_total / s.target_total) * 100) : 0;
  const cls = "scrape" + (s.stalled ? " stalled" : s.done ? " done" : "");

  return (
    <div className={cls}>
      <audio ref={audioRef} preload="auto">
        <source src="/sound/otus-sunia.mp3" type="audio/mpeg" />
        <source src="/sound/otus-sunia.ogg" type="audio/ogg" />
      </audio>

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
        {s.stalled ? (
          <>
            连续撞验证码或约 {Math.round(s.idle_seconds / 60)} 分钟无进展。验证码是自动换会话重试的、不需要你手动解；
            若长时间卡住多半是网络被限，可换网络或稍后重试。
            <button type="button" className="hoot" onClick={hoot} title="红角鸮叫一声">
              🔊 红角鸮
            </button>
          </>
        ) : s.done ? (
          "明细已抓全。导入并重新导出后，频率会更准、白马雪山等空清单会补上。"
        ) : (
          `本轮 ${s.session_fetched}/${s.session_todo} · 自动跳过验证码 ${s.captcha_events} 次（无需手动解）· ${s.updated_at} 更新`
        )}
      </div>
    </div>
  );
}
