import Ajv from 'ajv';
import { SCHEMA_REGISTRY } from '../schemas';

const ajv = new Ajv({ allErrors: true });

// Pre-compile all schemas
Object.keys(SCHEMA_REGISTRY).forEach(schemaId => {
  try {
    ajv.addSchema(SCHEMA_REGISTRY[schemaId], schemaId);
  } catch (e) {
    console.error(`Failed to compile schema: ${schemaId}`, e);
  }
});

export const validatePayload = (schemaId: string, payload: any): { isValid: boolean; errors: any[] } => {
  const validate = ajv.getSchema(schemaId);

  if (!validate) {
    // If no schema is defined for it (e.g. for HUMAN node), we can't validate, so we consider it valid.
    return { isValid: true, errors: [] };
  }
  
  const isValid = validate(payload);

  return {
    isValid: !!isValid,
    errors: validate.errors || [],
  };
};
