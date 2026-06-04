import { useCallback, useEffect, useState } from "react";

// 鸟种标记：目标(收藏) / 已学习 / 已见过 / 笔记。按中文名存（跨停留点全局）。
// 存 localStorage —— 不会被普通「清缓存」清掉，但清「网站数据」/无痕/极端存储压力下
// 可能丢，所以配一键备份导出/导入（见 TargetList）。
const KEY = "birdtrace_marks_v1";
const BLANK = { target: false, learned: false, seen: false, note: "" };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function save(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* 私密模式 / 存储满 —— 静默失败，内存里仍可用 */
  }
}

function isEmpty(e) {
  return !e.target && !e.learned && !e.seen && !(e.note && e.note.trim());
}

export function useMarks() {
  const [marks, setMarks] = useState(load);

  // 跨标签页同步
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setMarks(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const apply = useCallback((name, patch) => {
    setMarks((cur) => {
      const entry = { ...BLANK, ...(cur[name] || {}), ...patch };
      const next = { ...cur };
      if (isEmpty(entry)) delete next[name];
      else next[name] = entry;
      save(next);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (name, field) =>
      setMarks((cur) => {
        const entry = { ...BLANK, ...(cur[name] || {}) };
        entry[field] = !entry[field];
        const next = { ...cur };
        if (isEmpty(entry)) delete next[name];
        else next[name] = entry;
        save(next);
        return next;
      }),
    []
  );

  const setNote = useCallback((name, note) => apply(name, { note }), [apply]);

  // 备份导入：merge（默认，补充已见过等）或 replace（整体覆盖）
  const importMarks = useCallback((obj, mode = "merge") => {
    setMarks((cur) => {
      const next = mode === "replace" ? {} : { ...cur };
      for (const [k, v] of Object.entries(obj || {})) {
        if (!v || typeof v !== "object") continue;
        const entry = { ...BLANK, ...(next[k] || {}), ...v };
        if (!isEmpty(entry)) next[k] = entry;
      }
      save(next);
      return next;
    });
  }, []);

  return { marks, toggle, setNote, importMarks };
}
