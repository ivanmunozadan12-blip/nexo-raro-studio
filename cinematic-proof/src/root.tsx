import React from "react";
import { Composition } from "remotion";
import { AntikytheraFilm } from "./video";

export const Root: React.FC = () => (
  <Composition
    id="Antikythera"
    component={AntikytheraFilm}
    durationInFrames={540}
    fps={30}
    width={1080}
    height={1920}
  />
);
