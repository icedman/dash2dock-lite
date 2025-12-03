import Cairo from 'gi://cairo';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';

function load_image() {
  return new Promise((resolve, reject) => {
    const loader = new GdkPixbuf.PixbufLoader();

    loader.connect('size-prepared', (sz) => {
      console.log('size-prepared');
    });

    loader.connect('area-prepared', () => {
      print('area prepared');
    });

    loader.connect('closed', () => {
      print('loader closed');
      const pixbuf = loader.get_pixbuf(); // Get the loaded pixbuf
      console.log([pixbuf.width, pixbuf.height]);

      // Create a Cairo surface
      const surface = new Cairo.ImageSurface(
        Cairo.Format.ARGB32,
        pixbuf.get_width(),
        pixbuf.get_height()
      );
      const context = new Cairo.Context(surface);

      const imageData = pixbuf.get_pixels();
      const { width, height, rowstride } = pixbuf;
      const data = new Uint8Array(imageData);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * rowstride + x * 4;
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          const a = data[i + 3] / 255;
          context.setSourceRGBA(r, g, b, 1);
          context.rectangle(x, y, 1, 1);
          context.fill();
        }
      }

      surface.writeToPNG('/tmp/image.png');

      // Cleanup
      context.$dispose();

      console.log('surface prepared');

      resolve();
    });

    const file = Gio.File.new_for_path(
      // '/home/iceman/Pictures/9uKBABA.png',
      '/usr/share/backgrounds/gdm-login-background.jpg'
      // '/usr/share/icons/hicolor/48x48/apps/spotify.png'
    );

    const [success, contents] = file.load_contents(null);
    loader.write(contents);
    loader.close();
  });
}

load_image();

/*
const { Gio } = imports.gi;
const Cairo = imports.cairo;

function applyBlurToImage(inputPath, outputPath, blurRadius) {
    // Load the image using Gio.File
    let inputFile = Gio.File.new_for_path(inputPath);

    //try {
        let inputStream = inputFile.read(null);
        let fileContents = null;//inputStream.read_bytes(inputStream.query_info(null, 0).get_size());

        // Create a Cairo surface from the image data
        let imageSurface = Cairo.ImageSurface.create_from_png_stream(fileContents);

        // Create a new surface for the blurred image
        let blurredSurface = new Cairo.ImageSurface(Cairo.Format.ARGB32, imageSurface.get_width(), imageSurface.get_height());
        let cr = new Cairo.Context(blurredSurface);

        // Apply the blur effect
        cr.scale(imageSurface.get_width(), imageSurface.get_height());
        cr.setSourceSurface(imageSurface, 0, 0);
        cr.filter = Cairo.Filter.BLUR;
        cr.paint();

        // Write the blurred image to a PNG file
        blurredSurface.writeToPNG(outputPath);

        // Clean up resources
        cr.$dispose();
        blurredSurface.$dispose();
        imageSurface.$dispose();

        console.log(`Blurred image saved successfully: ${outputPath}`);
    //} catch (e) {
    //    console.log(`Error processing image: ${e.message}`);
    //}
}

// Example usage
let inputImagePath = '/usr/share/backgrounds/gdm-login-background.jpg';
let outputImagePath = '/tmp/output_blurred_image.png';

let blurRadius = 10; // Adjust blur radius as needed

applyBlurToImage(inputImagePath, outputImagePath, blurRadius);

*/
