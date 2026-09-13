export abstract class Mapper<In, Out> {
  abstract mapFrom(input: In): Out;
  abstract mapTo(input: Out): In;
}
