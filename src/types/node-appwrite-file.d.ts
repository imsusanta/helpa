declare module 'node-appwrite/file' {
  export const InputFile: {
    fromBuffer(
      data: Buffer | Uint8Array,
      filename?: string
    ): { data: Buffer | Uint8Array; filename?: string };
  };
}
