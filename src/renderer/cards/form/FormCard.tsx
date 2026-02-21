/**
 * FormCard Component
 * Renders a dynamic form from MCP server's formSchema.
 * Pre-fills values from data (e.g. extract tools).
 * On submit, calls the submitTool via MCP executeTool.
 *
 * Uses a module-level cache to persist form values across remounts
 * (streaming updates cause parent re-renders that remount this component).
 */

import React, { useState, useEffect } from 'react';
import { BaseCardProps, MCPMetadata, FormField } from '../types';
import './FormCard.css';

// Module-level cache: persists form values across remounts
// Keyed by submitTool name so each form type has its own cache
const formStateCache = new Map<string, {
  values: Record<string, string>;
  submitted: { success: boolean; message: string } | null;
}>();

interface FormCardProps extends BaseCardProps<Record<string, any> | null> {
  metadata?: MCPMetadata;
  toolCallId?: string; // For human-in-the-loop: resolves the pending AI tool call
  onFormSubmit?: (toolName: string, args: Record<string, any>) => void;
}

export const FormCard: React.FC<FormCardProps> = ({ data, metadata, toolCallId }) => {
  const formSchema = metadata?.formSchema;
  const cacheKey = formSchema?.submitTool || '';
  const cached = formStateCache.get(cacheKey);

  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    // Restore from cache if available
    if (cached?.values && Object.keys(cached.values).length > 0) {
      return cached.values;
    }
    // Otherwise pre-fill from data
    if (formSchema) {
      const initial: Record<string, string> = {};
      formSchema.fields.forEach((field: FormField) => {
        initial[field.name] = data?.[field.name]?.toString() || '';
      });
      return initial;
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(
    cached?.submitted || null
  );

  const title = metadata?.title || 'Fill Details';

  // Sync form values to cache on every change
  useEffect(() => {
    if (cacheKey) {
      formStateCache.set(cacheKey, { values: formValues, submitted: submitResult });
    }
  }, [formValues, submitResult, cacheKey]);

  if (!formSchema) {
    return (
      <div className="form-card form-card--error">
        <p>No form schema provided.</p>
      </div>
    );
  }

  const handleChange = (name: string, value: string) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Build args, converting number fields
      const args: Record<string, any> = {};
      formSchema.fields.forEach((field: FormField) => {
        const val = formValues[field.name];
        if (val !== undefined && val !== '') {
          if (field.type === 'number') {
            args[field.name] = parseFloat(val);
          } else {
            args[field.name] = val;
          }
        }
      });

      // Call the submitTool via MCP to actually create the record
      const result = await (window as any).api.mcp.executeTool(formSchema.submitTool, args);

      if (result.success) {
        // The MCP call succeeded, but check the server's actual response
        let serverResponse: any = null;
        try {
          serverResponse = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
        } catch {
          serverResponse = result.result;
        }

        // Check if the server itself reported failure
        if (serverResponse && serverResponse.success === false) {
          const errMsg = serverResponse.error || serverResponse.metadata?.error || 'Server could not complete the operation';
          setSubmitResult({ success: false, message: errMsg });
          // Resolve the pending AI promise with the error so AI can continue
          if (toolCallId) {
            (window as any).api.form.submitResult(toolCallId, { success: false, error: errMsg });
          }
        } else {
          setSubmitResult({ success: true, message: serverResponse?.metadata?.title || 'Saved successfully' });
          formStateCache.delete(cacheKey);
          // Resolve the pending AI promise with the creation result so AI can continue
          if (toolCallId) {
            (window as any).api.form.submitResult(toolCallId, {
              success: true,
              result: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
            });
          }
        }
      } else {
        setSubmitResult({ success: false, message: result.error || 'Failed to save' });
        if (toolCallId) {
          (window as any).api.form.submitResult(toolCallId, { success: false, error: result.error || 'Failed to save' });
        }
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unexpected error';
      setSubmitResult({ success: false, message: errMsg });
      if (toolCallId) {
        (window as any).api.form.submitResult(toolCallId, { success: false, error: errMsg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredFilled = formSchema.fields
    .filter((f: FormField) => f.required)
    .every((f: FormField) => formValues[f.name]?.trim());

  // After successful submit, show success state
  if (submitResult?.success) {
    return (
      <div className="form-card form-card--success">
        <div className="form-card__success-icon">✓</div>
        <p className="form-card__success-text">{submitResult.message}</p>
      </div>
    );
  }

  return (
    <div className="form-card">
      <div className="form-card__header">
        <h3 className="form-card__title">{title}</h3>
      </div>

      <form className="form-card__body" onSubmit={handleSubmit}>
        {formSchema.fields.map((field: FormField) => (
          <div key={field.name} className="form-card__field">
            <label className="form-card__label">
              {field.label}
              {field.required && <span className="form-card__required">*</span>}
            </label>

            {field.type === 'select' ? (
              <select
                className="form-card__select"
                value={formValues[field.name] || ''}
                onChange={e => handleChange(field.name, e.target.value)}
                required={field.required}
              >
                <option value="">{field.placeholder || 'Select...'}</option>
                {field.options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                className="form-card__textarea"
                value={formValues[field.name] || ''}
                onChange={e => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                required={field.required}
              />
            ) : (
              <input
                className="form-card__input"
                type={field.type}
                value={formValues[field.name] || ''}
                onChange={e => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
          </div>
        ))}

        {submitResult && !submitResult.success && (
          <div className="form-card__error">{submitResult.message}</div>
        )}

        <button
          type="submit"
          className="form-card__submit"
          disabled={!requiredFilled || isSubmitting}
        >
          {isSubmitting ? (
            <span className="form-card__spinner" />
          ) : (
            formSchema.submitLabel || 'Submit'
          )}
        </button>
      </form>
    </div>
  );
};

export default FormCard;
