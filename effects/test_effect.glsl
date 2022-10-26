uniform sampler2D tex;
uniform float red;
uniform float green;
uniform float blue;
uniform float blend;

const int indexMatrix4x4[16] = int[](0,  8,  2,  10,
                                     12, 4,  14, 6,
                                     3,  11, 1,  9,
                                     15, 7,  13, 5);

float indexValue() {
    int x = int(mod(gl_FragCoord.x, 4));
    int y = int(mod(gl_FragCoord.y, 4));
    return indexMatrix4x4[(x + y * 4)] / 16.0;
}

float dither(float color) {
    float closestColor = (color < 0.5) ? 0 : 1;
    float secondClosestColor = 1 - closestColor;
    float d = indexValue();
    float distance = abs(closestColor - color);
    return (distance < d) ? closestColor : secondClosestColor;
}

vec3 greyscale(vec3 color, float str) {
    float g = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(color, vec3(g), str);
}

vec3 greyscale(vec3 color) {
    return greyscale(color, 1.0);
}

void amiga_colors() {
    float d8 = 216/256;

    vec3 COLORS[14];
    COLORS[0] = vec3( 0.0, 0.0, 0.0 );
    COLORS[1] = vec3( 0.0, 0.0, d8);
    COLORS[2] = vec3( 0.0, 0.0, 1.0 );
    COLORS[3] = vec3( d8, 0.0, 0.0 );
    COLORS[4] = vec3( 1., 0.0, 0.0 );
    COLORS[5] = vec3( d8, 0.0, d8 );
    COLORS[6] = vec3( 1., 0.0, 1. );
    COLORS[7] = vec3( 0.0, d8, 0.0 );
    COLORS[8] = vec3( 0.0, 1, 0.0 );
    COLORS[9] = vec3( 0.0, d8, d8 );
    COLORS[10] = vec3( 0.0, 1., 1. );
    COLORS[11] = vec3( d8, d8, 0.0 );
    COLORS[12] = vec3( 1., 1., 0.0 );
    COLORS[13] = vec3( d8, d8, d8 );
    COLORS[14] = vec3( 1., 1., 1. );

    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);

    int nearestIdx = 0;
    float nearestDst = -1;
    for(int i=0; i<15; i++) {
        vec3 diff = c.rgb - COLORS[i];
        float dst = (diff.r * diff.r) + (diff.g * diff.g) + (diff.b * diff.b);
        if (nearestDst == -1 || dst < nearestDst) {
            nearestIdx = i;
            nearestDst = dst;
        }
    }

    vec3 pix_color = COLORS[nearestIdx];

    vec3 color = vec3(dither(red) * c.a, dither(green) * c.a, dither(blue) * c.a);
    cogl_color_out = vec4(mix(pix_color, color, blend), c.a);
}

void xmain() {
    amiga_colors();
}

void main() {
    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
    vec3 pix_color = c.rgb;
    vec3 color = vec3(dither(red) * c.a, dither(green) * c.a, dither(blue) * c.a);

    cogl_color_out = vec4(mix(pix_color, color, blend), c.a);
}
