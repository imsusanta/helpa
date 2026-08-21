export const InputFile = {
  fromBuffer(data: Buffer | Uint8Array, filename?: string) {
    return { data, filename };
  },
};
