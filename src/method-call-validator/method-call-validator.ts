import Ajv, { ErrorObject, Ajv as IAjv } from "ajv"
import { generateMethodParamId } from "../generate-method-id"
import ParameterValidationError from "./parameter-validation-error"
import { OpenrpcDocument as OpenRPC, MethodObject, ContentDescriptorObject } from "@open-rpc/meta-schema"
import MethodNotFoundError from "./method-not-found-error"
import { find, compact } from "../helper-functions"
import { err, ok, Result } from "neverthrow"

const isByName = (params: Record<string, unknown> | unknown[]): params is Record<string, unknown> => !Array.isArray(params)

const isByPosition = (params: Record<string, unknown> | unknown[]): params is unknown[] => Array.isArray(params)

/**
 * Validates a particular method call against the OpenRPC definition for the method.
 *
 * @param methodName the name of the method in the OpenRPC Document.
 * @param params the param values that you want validated.
 *
 * @returns an array of parameter validation errors, or if there are none, an empty array.
 * if the method name is invalid, a [[MethodNotFoundError]] is returned.
 *
 * @example
 * ```typescript
 *
 * import { petstore } from "@open-rpc/examples";
 * const petStoreMethodCallValidator = new MethodCallValidator(petstore);
 * const errors = petStoreMethodCallValidator.validate("list_pets", []);
 * // errors.length === 0
 * ```
 *
 */
export const validate = (
  document: OpenRPC,
  methodName: string,
  params: Record<string, unknown> | unknown[],
): Result<undefined, Error[]> => {
  const ajvValidator = new Ajv()

  // @ts-ignore
  document.methods.forEach((method: MethodObject) => {
    const params = method.params as ContentDescriptorObject[]
    if (method.params === undefined) return

    params.forEach((param: ContentDescriptorObject) => {
      if (param.schema === undefined) return

      ajvValidator.addSchema(param.schema as any, generateMethodParamId(method, param))
    })
  })

  if (methodName === "rpc.discover") return ok(undefined)
  const method = find(document.methods, (o: MethodObject) => { return o.name == methodName }) as MethodObject

  if (!method) {
    return err([new MethodNotFoundError(methodName, document, params)])
  }

  if (method.params) {
    const paramMap = (method.params as ContentDescriptorObject[])
    const errors = compact(paramMap.map((param: ContentDescriptorObject, index: number) => {
      let input: unknown

      if (method.paramStructure === "by-position" && isByPosition(params)) {
        input = params[index]
      } else if (method.paramStructure === "by-name" && isByName(params)) {
        input = params[param.name]
      }

      if(!method.paramStructure) {
        if(isByPosition(params)) {
          input = params[index]
        }

        if(isByName(params)) {
          input = params[param.name]
        }
      }

      if (input === undefined && !param.required) { return; }

      if (param.schema !== undefined) {
        const idForMethod = generateMethodParamId(method, param);
        const isValid = ajvValidator.validate(idForMethod, input);
        const errors = ajvValidator.errors as ErrorObject[];

        if (!isValid) {
          return new ParameterValidationError(index, param.schema, input, errors);
        }
      }
    }))
    
    return errors.length > 0 ? err(errors) : ok(undefined)
  } else {
    return ok(undefined)
  }
}

