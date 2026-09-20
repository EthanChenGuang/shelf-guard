/** Load natural dimensions from a data URL or image URL — used for baseline upload (STAB-04). */
export async function loadImageDimensions(
  dataUrl: string,
): Promise<{width: number; height: number}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({width: img.naturalWidth, height: img.naturalHeight});
    img.onerror = () => reject(new Error('Failed to load image dimensions'));
    img.src = dataUrl;
  });
}
