/** The box round everything not see-through in a picture, as shares of its width and height: left, top, right, bottom. The whole picture where it cannot be read. */
export function inkOf(src: HTMLCanvasElement): [number, number, number, number] {
  let box: [number, number, number, number] = [0, 0, 1, 1];
  try {
    const W = src.width, H = src.height;
    const px = src.getContext('2d')?.getImageData(0, 0, W, H).data;
    if (px) {
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0, i = y * W * 4 + 3; x < W; x++, i += 4) {
          if (!px[i]) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
      }
      if (x1 >= 0) box = [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H];
    }
  } catch {
    // A picture that cannot be read is kept whole.
  }
  return box;
}
