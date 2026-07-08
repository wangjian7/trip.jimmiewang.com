"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  resolveCityInput,
  searchCities,
  type AirportCity,
} from "@/lib/airport-cities";

type CityAutocompleteProps = {
  label: string;
  value: string;
  selectedCode: string | null;
  onChange: (displayValue: string, code: string | null) => void;
  placeholder?: string;
};

export function CityAutocomplete({
  label,
  value,
  selectedCode,
  onChange,
  placeholder,
}: CityAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AirportCity[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setOptions(searchCities(value));
    setActiveIndex(0);
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function selectCity(city: AirportCity) {
    onChange(city.display, city.code);
    setOpen(false);
  }

  function commitFreeText() {
    const resolved = resolveCityInput(value);
    if (resolved) {
      onChange(resolved.display, resolved.code);
    } else {
      onChange(value, null);
    }
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      <label htmlFor={listId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={listId}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="rounded-xl border vv-border bg-[color:var(--vv-surface-lowest)] px-4 py-3 text-sm outline-none focus:border-[color:var(--vv-accent-2)]"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value, null);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(commitFreeText, 120);
        }}
        onKeyDown={(event) => {
          if (!open || options.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % options.length);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + options.length) % options.length);
          }
          if (event.key === "Enter" && options[activeIndex]) {
            event.preventDefault();
            selectCity(options[activeIndex]);
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {selectedCode ? (
        <p className="vv-muted text-xs">
          已识别为 {selectedCode}
          {resolveCityInput(value)?.hint ? `（${resolveCityInput(value)?.hint}）` : ""}
        </p>
      ) : value.trim() ? (
        <p className="text-xs text-[color:var(--vv-error)]">请从列表选择或输入支持的城市</p>
      ) : null}
      {open && options.length > 0 ? (
        <ul
          className="vv-card max-h-56 overflow-auto rounded-xl border vv-border bg-[color:var(--vv-surface-lowest)] p-1 shadow-lg"
          role="listbox"
        >
          {options.map((city, index) => (
            <li key={city.code}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition ${
                  index === activeIndex
                    ? "bg-[color:var(--vv-surface-low)]"
                    : "hover:bg-[color:var(--vv-surface-low)]"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCity(city)}
              >
                <span className="font-medium">{city.display}</span>
                <span className="vv-muted text-xs">
                  {city.code}
                  {city.hint ? ` · ${city.hint}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
