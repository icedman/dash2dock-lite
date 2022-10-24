uniform sampler2D tex;
uniform float red;
uniform float green;
uniform float blue;
uniform float blend;

void amiga_colors() {
    float d8 = 216/256;

    vec3 COLORS[44];
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

    for(int i=1; i<15; i++) {
        COLORS[14+i] = COLORS[i]/2;
    }

    for(int i=1; i<15; i++) {
        COLORS[28+i] = COLORS[i]/3;
    }

    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);

    int nearestIdx = 0;
    float nearestDst = -1;
    for(int i=0; i<45; i++) {
        vec3 diff = c.rgb - COLORS[i];
        float dst = (diff.r * diff.r) + (diff.g * diff.g) + (diff.b * diff.b);
        if (nearestDst == -1 || dst < nearestDst) {
            nearestIdx = i;
            nearestDst = dst;
        }
    }

    vec3 pix_color = COLORS[nearestIdx];

    vec3 color = vec3(red * c.a, green * c.a, blue * c.a);
    cogl_color_out = vec4(mix(pix_color, color, blend), c.a);
}

void main() {
    amiga_colors();
}