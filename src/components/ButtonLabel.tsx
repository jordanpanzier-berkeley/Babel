import React from 'react';

interface ButtonLabelProps {
  /** Text shown on the button */
  text: string;
  /** Widest text this button can show; reserves its size so the button never resizes */
  reserve?: string;
}

/**
 * Button text whose hover-widening never changes the button's size.
 * A hidden copy of the widest label, set at full width, fixes the button's size;
 * the visible text widens inside that space on hover.
 */
export const ButtonLabel: React.FC<ButtonLabelProps> = ({ text, reserve }) => (
  <span className="label">
    <span className="label__ghost" aria-hidden="true">{reserve ?? text}</span>
    <span className="label__text">{text}</span>
  </span>
);
