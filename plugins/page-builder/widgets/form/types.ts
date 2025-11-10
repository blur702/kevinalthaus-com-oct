import { WidgetConfig } from '../../src/types';

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface FormConfig extends WidgetConfig {
  fields: FormField[];
  submitButtonText: string;
  submitButtonColor: string;
  action: string;
  method: 'POST' | 'GET';
}
