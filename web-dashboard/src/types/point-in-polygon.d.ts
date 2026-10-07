declare module 'point-in-polygon' {
  export default function pointInPolygon(
    point: [number, number],
    vs: [number, number][],
  ): boolean;
}
