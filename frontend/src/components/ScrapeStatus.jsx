import { useEffect, useRef, useState } from "react";

// 通用后台抓取进度条。轮询一个状态 JSON（schema 见 scrape_status.py /
// fetch_report_detail.py，两者一致）。卡住(stalled)时叫一声红角鸮 + 弹提醒。
// 用 props 复用：鸟种明细 用 /data/scrape_status.json，坐标 用 /data/coords_status.json。
export default function ScrapeStatus({
  src = "/data/scrape_status.json",
  noun = "鸟种明细",
  // 坐标接口(/front/activity/get)撞死后得人工过一次验证码才放行（实测换会话绕不过，
  // 与鸟种明细接口不同）。开 manualCaptcha 时，卡住文案改成「请去手动解」。
  manualCaptcha = false,
}) {
  const [s, setS] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const audioRef = useRef(null);
  const playedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(src, { cache: "no-store" });
        if (r.ok && alive) setS(await r.json());
        else if (alive) setS(null);
      } catch {
        if (alive) setS(null);
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [src]);

  function hoot() {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  useEffect(() => {
    if (s?.stalled) {
      if (!playedRef.current) {
        playedRef.current = true;
        hoot();
        setShowAlert(true);
      }
    } else {
      playedRef.current = false;
      setShowAlert(false);
    }
  }, [s?.stalled]);

  if (!s || (!s.running && !s.stalled && !s.done)) return null;
  const pct = s.target_total ? Math.floor((s.have_total / s.target_total) * 100) : 0;
  const remaining = Math.max((s.target_total || 0) - (s.have_total || 0), 0);
  const trulyDone = s.done && remaining === 0;
  const endedShort = s.done && remaining > 0;
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
              <b>⚠ {noun}补抓卡住了</b>
              <button className="x" onClick={() => setShowAlert(false)} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="owl-body">
              <div className="owl-ico">🦉</div>
              <p>
                后台抓{noun}连续撞验证码、暂时没新进展（{s.have_total}/{s.target_total}）。
                {manualCaptcha ? (
                  <>
                    这个接口换会话绕不过，需要你去 <b>birdreport.cn</b> 手动过一次验证码
                    （随便点开一份报告、看到图就输一下），抓取会<b>自己恢复继续</b>，不用重跑。
                  </>
                ) : (
                  <>
                    验证码是<b>自动换会话重试</b>的，<b>不需要你手动解</b>；若长时间卡住多半是网络被限，
                    换个网络或稍后再试即可。它会自己继续，你也可以先做别的。
                  </>
                )}
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
            ? `⚠ ${noun}补抓卡住了`
            : trulyDone
            ? `✓ ${noun}补抓完成`
            : endedShort
            ? `◑ ${noun}补抓暂停`
            : `⟳ ${noun}补抓中`}
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
            连续撞验证码或约 {Math.round(s.idle_seconds / 60)} 分钟无进展。
            {manualCaptcha
              ? "请去 birdreport.cn 手动过一次验证码，抓取会自己恢复继续（不用重跑）。"
              : "验证码是自动换会话重试的、不需要你手动解；若长时间卡住多半是网络被限，可换网络或稍后重试。"}
            <button type="button" className="hoot" onClick={hoot} title="红角鸮叫一声">
              🔊 红角鸮
            </button>
          </>
        ) : trulyDone ? (
          `${noun}已抓全。`
        ) : endedShort ? (
          `到上限停了，还差 ${remaining} 份没抓到（反复撞验证码或没轮到）。不是出错——重跑可续抓，已抓的会跳过。`
        ) : (
          `本轮 ${s.session_fetched}/${s.session_todo} · 自动跳过验证码 ${s.captcha_events} 次（无需手动解）· ${s.updated_at} 更新`
        )}
      </div>
    </div>
  );
}
