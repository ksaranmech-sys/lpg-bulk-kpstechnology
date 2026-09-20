import React, { useEffect, useRef, useState } from 'react';

// Custom combobox so the suggestions dropdown always matches the input's own
// width - native <input list> + <datalist> popups ignore CSS sizing entirely.
export default function ComboBoxInput({ value, onChange, options, placeholder, required }) {
  const [open, setOpen] = useState(false);
  // Typing filters by the current text, but opening via the dropdown arrow should
  // always show every option, even after a value is already selected.
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = (options || []).filter((option) => (
    !value || option.toLowerCase().includes(String(value).toLowerCase())
  ));
  const displayedOptions = showAll ? (options || []) : filtered;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowAll(false); setOpen(true); }}
        onFocus={() => { setShowAll(false); setOpen(true); }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        style={{ paddingRight: 32 }}
      />
      <span
        aria-hidden="true"
        onClick={() => {
          setOpen((current) => !current);
          setShowAll(true);
        }}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', cursor: 'pointer', color: '#64748b',
        }}
      >
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {open && displayedOptions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          margin: '4px 0 0', padding: 4, listStyle: 'none',
          background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 20px rgba(15,35,47,0.12)', maxHeight: 220, overflowY: 'auto',
        }}>
          {displayedOptions.map((option) => (
            <li
              key={option}
              onMouseDown={() => { onChange(option); setOpen(false); }}
              style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
