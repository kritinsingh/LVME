import math

def euclidean_distance(p1, p2):
    """Calculate the Euclidean distance between two 2D or 3D points."""
    dist = 0
    for i in range(len(p1)):
        dist += (p1[i] - p2[i]) ** 2
    return math.sqrt(dist)
