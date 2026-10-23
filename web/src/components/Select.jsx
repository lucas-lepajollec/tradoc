import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

const GAP = 6;
const EDGE = 8;
const MAX_WIDTH = 380;
const MAX_HEIGHT = 320;

/**
 * Themed replacement for <select>. The native popup is drawn by the browser at
 * the width of its longest option and can spill past the screen edge (onto a
 * second monitor); this list is positioned inside the viewport instead.
 *
 * options: [{ value, label, group? }] — consecutive options sharing a group
 * are shown under that group's heading.
 */
export default function Select({
  value,
  onChange,
  options = [],
  ariaLabel,
  className = '',
  placeholder = '',
  disabled = false,
  id,
}) {
  const listId = useId();
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];
  const display = selected?.label ?? (value || placeholder);

  const sections = useMemo(() => {
    const result = [];
    options.forEach((option, index) => {
      const last = result[result.length - 1];
      if (!last || last.group !== option.group) result.push({ group: option.group, items: [] });
      result[result.length - 1].items.push({ option, index });
    });
    return result;
  }, [options]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(Math.max(rect.width, 200), MAX_WIDTH, viewportWidth - EDGE * 2);
    const left = Math.min(Math.max(EDGE, rect.left), viewportWidth - EDGE - width);
    const below = viewportHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const openUp = below < Math.min(MAX_HEIGHT, 200) && above > below;
    const maxHeight = Math.max(120, Math.min(MAX_HEIGHT, openUp ? above : below));
    setPosition({
      left,
      width,
      maxHeight,
      top: openUp ? undefined : rect.bottom + GAP,
      bottom: openUp ? viewportHeight - rect.top + GAP : undefined,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (triggerRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', closeOutside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const openList = () => {
    if (disabled || options.length === 0) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (index) => {
    const option = options[index];
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
    if (option && option.value !== value) onChange(option.value);
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (active >= 0) choose(active);
    } else if (event.key.length === 1) {
      const letter = event.key.toLowerCase();
      const next = options.findIndex((option, index) => index > active && String(option.label).toLowerCase().startsWith(letter));
      const first = options.findIndex((option) => String(option.label).toLowerCase().startsWith(letter));
      if (next >= 0 || first >= 0) setActive(next >= 0 ? next : first);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`select-trigger ${className}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{display}</span>
        <ChevronDown aria-hidden="true" className={`select-chevron ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && position && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="select-list"
          style={{ left: position.left, width: position.width, maxHeight: position.maxHeight, top: position.top, bottom: position.bottom }}
        >
          {sections.map((section, sectionIndex) => (
            <div key={`${section.group || ''}-${sectionIndex}`} role={section.group ? 'group' : undefined} aria-label={section.group || undefined}>
              {section.group && <div className="select-group" aria-hidden="true">{section.group}</div>}
              {section.items.map(({ option, index }) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={`${option.value}`}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    title={String(option.label)}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(index)}
                    className={`select-option ${index === active ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected && <Check aria-hidden="true" className="size-4 flex-none" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
