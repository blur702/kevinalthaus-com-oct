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
      <div className="form-widget-editor">
        <style>{`
          .form-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .form-heading { margin: 0 0 12px 0; }
          .form-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .form-label { display: block; margin-bottom: 4px; font-weight: bold; }
          .form-input { width: 100%; padding: 8px; }
          .form-color { width: 100%; height: 36px; }
          .form-fields-title { margin: 16px 0 8px 0; }
          .form-field { margin-bottom: 12px; padding: 12px; background-color: #f9f9f9; border-radius: 4px; }
          .form-field-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .btn-remove { padding: 4px 8px; background-color: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
          .form-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; padding-left: 8px; }
          .btn-add { width: 100%; padding: 8px; background-color: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        `}</style>
        <h4 className="form-heading">Form Settings</h4>

        <div className="form-settings-grid">
          <div>
            <label htmlFor={`${widget.id}-action-url`} className="form-label">
              Form Action URL:
            </label>
            <input
              type="url"
              id={`${widget.id}-action-url`}
              value={config.action}
              onChange={(e) => handleConfigChange({ action: e.target.value })}
              className="form-input"
              placeholder="/api/forms/submit"
            />
          </div>

          <div>
            <label htmlFor={`${widget.id}-method`} className="form-label">
              Method:
            </label>
            <select
              id={`${widget.id}-method`}
              value={config.method}
              onChange={(e) => handleConfigChange({ method: e.target.value as any })}
              className="form-input"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${widget.id}-submit-text`} className="form-label">
              Submit Button Text:
            </label>
            <input
              type="text"
              id={`${widget.id}-submit-text`}
              value={config.submitButtonText}
              onChange={(e) => handleConfigChange({ submitButtonText: e.target.value })}
              className="form-input"
            />
          </div>

          <div>
            <label htmlFor={`${widget.id}-button-color`} className="form-label">
              Button Color:
            </label>
            <input
              type="color"
              id={`${widget.id}-button-color`}
              value={config.submitButtonColor}
              onChange={(e) => handleConfigChange({ submitButtonColor: e.target.value })}
              className="form-color"
            />
          </div>
        </div>

        <h5 className="form-fields-title">Form Fields:</h5>

        {config.fields.map((field, index) => (
          <div key={field.id} className="form-field">
            <div className="form-field-header">
              <strong>Field {index + 1}</strong>
              <button
                onClick={() => removeField(field.id)}
                className="btn-remove"
              >
                Remove
              </button>
            </div>

            <div className="form-field-grid">
              <select
                id={`${field.id}-type`}
                aria-label="Field type"
                value={field.type}
                onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                className="form-input"
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
                id={`${field.id}-label`}
                aria-label="Field label"
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                placeholder="Field label"
                className="form-input"
              />

              <input
                type="text"
                id={`${field.id}-placeholder`}
                aria-label="Field placeholder"
                value={field.placeholder || ''}
                onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                placeholder="Placeholder"
                className="form-input"
              />

              <label className="checkbox-inline">
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
          className="btn-add"
        >
          + Add Field
        </button>
      </div>
    );
  }

  return (
    <form className="form-widget" onSubmit={handleSubmit}>
      <style>{`
        .form-group { margin-bottom: 16px; }
        .form-label-block { display: block; margin-bottom: 4px; font-weight: bold; }
        .input-full { width: 100%; padding: 8px; }
        .textarea-full { width: 100%; padding: 8px; min-height: 100px; font-family: inherit; }
        .checkbox-row { display: flex; align-items: center; gap: 8px; }
        .submit-btn { padding: 12px 24px; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px; }
        .submit-btn-${widget.id} { background-color: ${config.submitButtonColor}; }
        .required-asterisk { color: red; }
      `}</style>
      {config.fields.map((field) => (
        <div key={field.id} className="form-group">
          <label htmlFor={field.id} className="form-label-block">
            {field.label} {field.required && <span className="required-asterisk">*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              id={field.id}
              name={field.id}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              className="textarea-full"
            />
          ) : field.type === 'checkbox' ? (
            <label className="checkbox-row">
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
              className="input-full"
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
              className="input-full"
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        className={`submit-btn submit-btn-${widget.id}`}
      >
        {config.submitButtonText}
      </button>
    </form>
  );
}
