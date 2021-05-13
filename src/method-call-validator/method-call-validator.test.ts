import { validate } from "./method-call-validator"
import { OpenrpcDocument as OpenRPC, OpenrpcDocument } from "@open-rpc/meta-schema";
import MethodCallParameterValidationError from "./parameter-validation-error";
import MethodCallMethodNotFoundError from "./method-not-found-error";
import MethodNotFoundError from "./method-not-found-error";

const getExampleSchema = (): OpenRPC => ({
  info: { title: "123", version: "1" },
  methods: [
    {
      name: "foo",
      params: [{ name: "foofoo", required: true, schema: { type: "string" } }],
      result: { name: "foofoo", schema: { type: "integer" } },
    },
  ],
  openrpc: "1.0.0-rc1",
}) as OpenRPC;

describe("MethodCallValidator", () => {
  const example = getExampleSchema()
  const validateSchema = validate.bind(null, example)

  it("can validate a method call", () => {
    const result = validateSchema("foo", ["foobar"])
    expect(result._unsafeUnwrap()).toEqual(undefined)
  })

  it("can handle having params undefined", () => {
    const example = getExampleSchema()
    // @ts-ignore
    delete example.methods[0].params
    const result = validate(example, "foo", ["foobar"])
    expect(result._unsafeUnwrap()).toEqual(undefined)
  })

  it("returns array of errors if invalid", () => {
    const result = validateSchema("foo", [123])._unsafeUnwrapErr()
    expect(result.length).toBe(1);
    expect(result[0]).toBeInstanceOf(MethodCallParameterValidationError);
  });

  it("can not error if param is optional", () => {
    const example = getExampleSchema() as any
    example.methods[0].params[0].required = false
    const result = validate(example, "foo", [])._unsafeUnwrap()
    expect(result).toEqual(undefined);
  });

  it("rpc.discover is allowed", () => {
    const result = validateSchema("rpc.discover", [])._unsafeUnwrap()
    expect(result).toEqual(undefined);
  });

  it("returns method not found error when the method name is invalid", () => {
    const result = validateSchema("boo", ["123"])._unsafeUnwrapErr()
    expect(result[0]).toBeInstanceOf(MethodCallMethodNotFoundError);
  });

  it("validates methods that use by-name", () => {
    const example = {
      info: { title: "123", version: "1" },
      methods: [
        {
          name: "foo",
          paramStructure: "by-name",
          params: [
            { name: "foofoo", required: true, schema: { type: "string" } },
            { name: "barbar", required: true }
          ],
          result: { name: "foofoo", schema: { type: "integer" } },
        },
      ],
      openrpc: "1.0.0-rc1",
    } as OpenrpcDocument

    const validateExampleSchema = validate.bind(null, example)

    const result0 = validateExampleSchema("foo", { foofoo: "123", barbar: "abc" })._unsafeUnwrap()
    expect(result0).toBeUndefined()
    const result1 = validateExampleSchema("foo", { foofoo: 123, barbar: "abc" })._unsafeUnwrapErr()
    expect(result1[0]).toBeInstanceOf(MethodCallParameterValidationError)
  })


  it("validates methods that use by-position", () => {
    const example = {
      info: { title: "123", version: "1" },
      methods: [
        {
          name: "foo",
          paramStructure: "by-position",
          params: [{ name: "foofoo", required: true, schema: { type: "string" } }],
          result: { name: "foofoo", schema: { type: "integer" } },
        },
      ],
      openrpc: "1.0.0-rc1",
    } as OpenrpcDocument

    const validateExampleSchema = validate.bind(null, example)

    const result0 = validateExampleSchema("foo", ["123"])._unsafeUnwrap()
    expect(result0).toBeUndefined()
    const result1 = validateExampleSchema("foo", [123])._unsafeUnwrapErr()
    expect(result1[0]).toBeInstanceOf(MethodCallParameterValidationError)
  })

  it("validates methods that use by-name when the param key doesnt exist", () => {
    const example = {
      info: { title: "123", version: "1" },
      methods: [
        {
          name: "foo",
          paramStructure: "by-name",
          params: [{ name: "foofoo", required: true, schema: { type: "string" } }],
          result: { name: "foofoo", schema: { type: "integer" } },
        },
      ],
      openrpc: "1.0.0-rc1",
    } as OpenrpcDocument

    const validateExampleSchema = validate.bind(null, example)

    const result0 = validateExampleSchema("foo", { barbar: "123" })._unsafeUnwrapErr()
    expect(result0).toBeInstanceOf(Array);
    expect(result0).toHaveLength(1);
  });

  it("method not found errors work when the document has params passed by-name", () => {

    const result0 = validateSchema("rawr", { barbar: "123" })._unsafeUnwrapErr()
    expect(result0[0]).toBeInstanceOf(MethodNotFoundError)
  });
});
