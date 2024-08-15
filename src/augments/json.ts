import {assertValidShape, type ShapeDefinition} from 'object-shape-tester';

export function parseJsonWithShape<Shape extends ShapeDefinition<any, boolean>>(
    jsonString: string,
    shape: Shape,
): Shape['runTimeType'] {
    const result = JSON.parse(jsonString);
    assertValidShape(result, shape);

    return result;
}
