import axios from "axios";

export const downloadBytes = async (url: string) => {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return new Uint8Array(res.data);
};
