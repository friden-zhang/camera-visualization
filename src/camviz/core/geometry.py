from __future__ import annotations

from typing import cast

import numpy as np
import numpy.typing as npt

from camviz.api.models import CustomPointSpec, Edge, Face, LabeledPoint3D


def build_custom_geometry(
    spec: CustomPointSpec,
) -> tuple[list[LabeledPoint3D], list[Edge], list[Face], np.ndarray]:
    if not spec.points:
        raise ValueError("custom_points requires at least one point")
    center = cast(
        npt.NDArray[np.float64],
        np.mean(
            [[point.x, point.y, point.z] for point in spec.points],
            axis=0,
            dtype=np.float64,
        ),
    )
    return spec.points, spec.edges, spec.faces, center

