import React from 'react';
import { encodeModelChoice } from '../providers';

// A native select listing the models of every connected provider, grouped by
// provider. The value encodes "provider::model" so a pick can switch provider.
export default function ModelSelect({ groups = [], provider, model, onChange, className = '', ...props }) {
  const value = encodeModelChoice(provider, model);
  const known = groups.some((group) => group.provider === provider && group.models.includes(model));
  const options = (group) => group.models.map((item) => (
    <option key={encodeModelChoice(group.provider, item)} value={encodeModelChoice(group.provider, item)}>{item}</option>
  ));

  return (
    <select {...props} className={className} value={value} onChange={(event) => onChange(event.target.value)}>
      {!known && model && <option value={value}>{model}</option>}
      {groups.length > 1
        ? groups.map((group) => <optgroup key={group.provider} label={group.label}>{options(group)}</optgroup>)
        : groups.flatMap(options)}
    </select>
  );
}
