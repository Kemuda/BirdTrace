import { useEffect, useRef, useState } from "react";

// 后台补抓「鸟种明细」的实时进度条。轮询 /data/scrape_status.json（由
// data/process/scrape_status.py 每 ~15s 重写）。验证码是自动换会话重试的，
// 不需要人工解 —— 所以卡住时显示「stalled」提醒，而不是「请解验证码」。
// 卡住时（false→true）播一声红角鸮叫（Otus sunia，Wikimedia Commons 公有领域）。
export default function ScrapeStatus() {
  const [s, setS] = useState(null);
  const [showAlert, setShowAlert] = useState(false); // 卡住时弹一次提醒
  const audioRef = useRef(null);
  const playedRef = useRef(false); // 同一次 stall 只叫一次/弹一次，恢复后重置

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

  // 进入 stalled 时叫一声 + 弹一次提醒；恢复后重置，下次再卡会再叫/再弹
  useEffect(() => {
    if (s?.stalled) {
      if (!playedRef.current) {
        playedRef.current = true;
        hoot();
        setShowAlert(true);
      }
    } else {
      playedRef.current = false;
      setShowAlert(false); // 自己恢复了就把提醒关掉
    }
  }, [s?.stalled]);

  if (!s || (!s.running && !s.stalled && !s.done)) return null;
  // floor，避免 863/865 被四舍五入成 100% 却还显示"还差 2 份"
  const pct = s.target_total ? Math.floor((s.have_total / s.target_total) * 100) : 0;
  const remaining = Math.max((s.target_total || 0) - (s.have_total || 0), 0);
  const trulyDone = s.done && remaining === 0;       // 真抓全了
  const endedShort = s.done && remaining > 0;         // 进程结束但没抓全（到上限/放弃）
  const cls =
    "scrape" +
    (s.stalled ? " stalled" : trulyDone ? " done" : endedShort ? " paused" : "");

  return (
    <div className={cls}>
      <audio ref={audioRef} preload="auto">
        <source src="/sound/otus-sunia.mp3" type="audio/mpeg" />
        <source src="/sound/otus-sunia.ogg" type="audio/ogg" />
      </audio>

      {showAlert && (
        <div className="modal-bg" onClick={() => setShowAlert(false)}>
          <div className="modal owl-alert" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <b>⚠ 鸟种明细补抓卡住了</b>
              <button className="x" onClick={() => setShowAlert(false)} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="owl-body">
              <div className="owl-ico">🦉</div>
              <p>
                后台补抓连续撞验证码、暂时没新进展（{s.have_total}/{s.target_total}）。
                验证码是<b>自动换会话重试</b>的，<b>不需要你手动解</b>；若长时间卡住多半是网络被限，
                换个网络或稍后再试即可。它会自己继续，你也可以先做别的。
              </p>
            </div>
            <div className="owl-act">
              <button className="btn sm" onClick={hoot}>🔊 再听一次</button>
              <button className="btn sm solid" onClick={() => setShowAlert(false)}>知道了</button>
            </div>
          </div>
        </div>
      )}

      <div className="srow">
        <b>
          {s.stalled
            ? "⚠ 鸟种明细补抓卡住了"
            : trulyDone
            ? "✓ 鸟种明细补抓完成"
            : endedShort
            ? "◑ 鸟种明细补抓暂停"
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
        ) : trulyDone ? (
          "明细已抓全。导入并重新导出后，频率会更准、白马雪山等空清单会补上。"
        ) : endedShort ? (
          `到 3 小时上限停了，还差 ${remaining} 份没抓到（反复撞验证码或没轮到）。不是出错——重跑 fetch_trip.py 可续抓，已抓的会跳过。`
        ) : (
          `本轮 ${s.session_fetched}/${s.session_todo} · 自动跳过验证码 ${s.captcha_events} 次（无需手动解）· ${s.updated_at} 更新`
        )}
      </div>
    </div>
  );
}
