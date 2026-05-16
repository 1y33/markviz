// GLSL fragment shader — simple raymarched sphere with phong lighting.

#version 410 core

uniform vec2  iResolution;
uniform float iTime;
out vec4 fragColor;

float sphereSDF(vec3 p, float r) {
    return length(p) - r;
}

float scene(vec3 p) {
    return sphereSDF(p - vec3(0.0, 0.0, 4.0), 1.0);
}

vec3 calcNormal(vec3 p) {
    const float h = 0.0001;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * scene(p + k.xyy * h) +
        k.yyx * scene(p + k.yyx * h) +
        k.yxy * scene(p + k.yxy * h) +
        k.xxx * scene(p + k.xxx * h)
    );
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
    vec3 ro = vec3(0.0, 0.0, 0.0);
    vec3 rd = normalize(vec3(uv, 1.0));

    float t = 0.0;
    for (int i = 0; i < 64; ++i) {
        vec3 p = ro + rd * t;
        float d = scene(p);
        if (d < 0.001) break;
        t += d;
        if (t > 100.0) break;
    }

    vec3 col = vec3(0.05, 0.07, 0.10);
    if (t < 100.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 ldir = normalize(vec3(sin(iTime), 1.0, -1.0));
        float diff = max(dot(n, ldir), 0.0);
        col = vec3(0.2, 0.5, 0.9) * diff + 0.1;
    }
    fragColor = vec4(col, 1.0);
}
