import QRCode from 'qrcode';
export { labelPayload } from '../../shared/labels/labelPayload.js';

export const qrOptions = { errorCorrectionLevel: 'M', margin: 4, width: 1200 };
export function labelText(payload) {
  return JSON.stringify(payload);
}
export async function labelImage(payload) {
  try {
    return await QRCode.toDataURL(labelText(payload), qrOptions);
  } catch (error) {
    throw new Error(
      /too big|too large|cannot contain/i.test(error.message)
        ? 'Os dados excedem a capacidade desta etiqueta QR. Reduza os textos de identificação antes de solicitar novamente.'
        : 'Não foi possível gerar a imagem QR neste navegador. Reabra o registro e tente novamente.',
    );
  }
}
