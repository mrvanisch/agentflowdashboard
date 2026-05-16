"use client";

import { useMemo, useRef, useState } from "react";
import { resolveAvatarUrl } from "@/components/avatar-url";

type MentionUser = {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarUrl?: string | null;
};

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  placeholder?: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function MentionInput({ value, onChange, users, placeholder }: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  const mention = useMemo(() => {
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/(^|\s)@([a-zA-Z0-9_.-]*)$/);
    if (!match) return null;
    const start = beforeCaret.length - match[2].length - 1;
    return { start, term: match[2].toLowerCase() };
  }, [caret, value]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    return users
      .filter((user) => {
        const haystack = `${user.username} ${user.name}`.toLowerCase();
        return haystack.includes(mention.term);
      })
      .slice(0, 6);
  }, [mention, users]);

  function syncCaret(target: HTMLInputElement) {
    setCaret(target.selectionStart ?? target.value.length);
  }

  function chooseUser(user: MentionUser) {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(caret);
    const nextValue = `${before}@${user.username} ${after}`;
    const nextCaret = before.length + user.username.length + 2;
    onChange(nextValue);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  }

  return (
    <div className="mention-input">
      <input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          syncCaret(event.target);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={(event) => syncCaret(event.currentTarget)}
        onKeyUp={(event) => syncCaret(event.currentTarget)}
        onKeyDown={(event) => {
          if (!suggestions.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            chooseUser(suggestions[activeIndex] || suggestions[0]);
          }
          if (event.key === "Escape") {
            setCaret(0);
          }
        }}
      />
      {focused && suggestions.length > 0 && (
        <div className="mention-menu">
          {suggestions.map((user, index) => {
            const avatarUrl = resolveAvatarUrl(user.avatarUrl);
            return (
              <button
                type="button"
                key={user.id}
                className={index === activeIndex ? "active" : ""}
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseUser(user);
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.name} className="mention-avatar" style={{ objectFit: "cover" }} />
                ) : (
                  <span className="mention-avatar" style={{ background: user.avatarColor }}>{initials(user.name)}</span>
                )}
                <span>
                  <strong>{user.name}</strong>
                  <em>@{user.username}</em>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
