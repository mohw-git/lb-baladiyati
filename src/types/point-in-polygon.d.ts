declare module 'point-in-polygon' {
  type Point = [number, number];
  type Polygon = Point[];
  type MultiPolygon = Polygon[];

  export default function pointInPolygon(
    point: Point,
    polygon: Polygon | MultiPolygon,
  ): boolean;
}
