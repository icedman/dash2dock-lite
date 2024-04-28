// uniform sampler2D tex;
// uniform float red;
// uniform float green;
// uniform float blue;
// uniform float blend;

// void main() {
//     vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
//     vec3 pix_color = c.rgb;
//     vec3 color = vec3(red * c.a, green * c.a, blue * c.a);
//     cogl_color_out = vec4(mix(pix_color, color, blend), c.a);
// }


uniform sampler2D tex;
uniform float red;
uniform float green;
uniform float blue;
uniform float blend;
uniform vec2 textureSize; // Size of the texture being sampled

// Function to perform a simple blur
vec4 blur(sampler2D texture, vec2 texCoord) {
    vec4 sum = vec4(0.0);
    float blurSize = 0.05; // Adjust this for different blur strengths

    // Sample neighboring pixels and average their colors
    sum += texture2D(texture, texCoord + vec2(-blurSize, -blurSize));
    sum += texture2D(texture, texCoord + vec2(0.0, -blurSize));
    sum += texture2D(texture, texCoord + vec2(blurSize, -blurSize));
    sum += texture2D(texture, texCoord + vec2(-blurSize, 0.0));
    sum += texture2D(texture, texCoord);
    sum += texture2D(texture, texCoord + vec2(blurSize, 0.0));
    sum += texture2D(texture, texCoord + vec2(-blurSize, blurSize));
    sum += texture2D(texture, texCoord + vec2(0.0, blurSize));
    sum += texture2D(texture, texCoord + vec2(blurSize, blurSize));

    return sum / 9.0; // Adjust divisor for different blur strengths
}

void main() {
    vec2 texCoord = cogl_tex_coord_in[0].st;
    vec4 original = texture2D(tex, texCoord);

    vec4 blurred = blur(tex, texCoord);

    vec3 pix_color = blurred.rgb;
    vec3 color = vec3(red * blurred.a, green * blurred.a, blue * blurred.a);
    vec3 finalColor = mix(pix_color, color, blend);

    float a = original.a;
    if (a < 0.75) {
        a = 0;
    }
    cogl_color_out = vec4(finalColor, a);
}