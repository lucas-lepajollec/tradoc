import React from 'react';
import { encodeModelChoice } from '../providers';
import Select from './Select';

// Lists the models of every connected provider, grouped by provider. The value
// encodes "provider::model" so a pick can switch provider.
export default function ModelSelect({ groups = [], provider, model, onChange, className = '', 'aria-label': ariaLabel, ...props }) {
  const value = encodeModelChoice(provider, model);
  const known = groups.some((group) => group.provider === provider && group.models.includes(model));
  const grouped = groups.length > 1;
  const options = groups.flatMap((group) => group.models.map((item) => ({
    value: encodeModelChoice(group.provider, item),
    label: item,
    group: grouped ? group.label : undefined,
  })));
  if (!known && model) options.unshift({ value, label: model });

  return <Select {...props} ariaLabel={ariaLabel} className={className} value={value} options={options} onChange={onChange} />;
}
