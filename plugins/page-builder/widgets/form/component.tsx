import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { FormConfig, FormField } from './types';

interface FormWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function FormWidget({ widget, editMode, onChange }: FormWidgetProps) {
  const config = widget.config as FormConfig;
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleConfigChange = (updates: Partial<FormConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const addField = () => {
    const newField: FormField = {
      id: uuidv4(),
      type: 'text',
      label: 'New Field',
      required: false
    };
    handleConfigChange({ fields: [...config.fields, newField] });
  };

  const removeField = (id: string) => {
    handleConfigChange({ fields: config.fields.filter(field => field.id !== id) });
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    handleConfigChange({
      fields: config.fields.map(field => field.id === id ? { ...field, ...updates } : field)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(config.action, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        console.log('Form submitted successfully');
        setFormData({});
      } else {
        console.error('Form submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  if (editMode) {
    return (
      <div className="form-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Form Settings</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Form Action URL:
            </label>
            <input
              type="url"
              value={config.action}
              onChange={(e) => handleConfigChange({ action: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
              placeholder="/api/forms/submit"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Method:
            </label>
            <select
              value={config.method}
              onChange={(e) => handleConfigChange({ method: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Submit Button Text:
            </label>
            <input
              type="text"
              value={config.submitButtonText}
              onChange={(e) => handleConfigChange({ submitButtonText: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Button Color:
            </label>
            <input
              type="color"
              value={config.submitButtonColor}
              onChange={(e) => handleConfigChange({ submitButtonColor: e.target.value })}
              style={{ width: '100%', height: '36px' }}
            />
          </div>
        </div>

        <h5 style={{ margin: '16px 0 8px 0' }}>Form Fields:</h5>

        {config.fields.map((field, index) => (
          <div key={field.id} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong>Field {index + 1}</strong>
              <button
                onClick={() => removeField(field.id)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Remove
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <select
                value={field.type}
                onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                style={{ padding: '6px' }}
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="tel">Phone</option>
                <option value="textarea">Textarea</option>
                <option value="select">Select</option>
                <option value="checkbox">Checkbox</option>
              </select>

              <input
                type="text"
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                placeholder="Field label"
                style={{ padding: '6px' }}
              />

              <input
                type="text"
                value={field.placeholder || ''}
                onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                placeholder="Placeholder"
                style={{ padding: '6px' }}
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(field.id, { required: e.target.checked })}
                />
                <span>Required</span>
              </label>
            </div>
          </div>
        ))}

        <button
          onClick={addField}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          + Add Field
        </button>
      </div>
    );
  }

  return (
    <form className="form-widget" onSubmit={handleSubmit}>
      {config.fields.map((field) => (
        <div key={field.id} style={{ marginBottom: '16px' }}>
          <label htmlFor={field.id} style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            {field.label} {field.required && <span style={{ color: 'red' }}>*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              id={field.id}
              name={field.id}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              style={{ width: '100%', padding: '8px', minHeight: '100px', fontFamily: 'inherit' }}
            />
          ) : field.type === 'checkbox' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id={field.id}
                name={field.id}
                required={field.required}
                checked={formData[field.id] || false}
                onChange={(e) => setFormData({ ...formData, [field.id]: e.target.checked })}
              />
              <span>{field.placeholder || 'Check this box'}</span>
            </label>
          ) : field.type === 'select' ? (
            <select
              id={field.id}
              name={field.id}
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">Select an option...</option>
              {field.options?.map((option, idx) => (
                <option key={idx} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              id={field.id}
              name={field.id}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        style={{
          padding: '12px 24px',
          backgroundColor: config.submitButtonColor,
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px'
        }}
      >
        {config.submitButtonText}
      </button>
    </form>
  );
}
