const nodemailer = require("nodemailer");

async function test() {

  console.log("Start SMTP test...");

  const transporter = nodemailer.createTransport({

    host: "smtp.strato.com",

    port: 587, // 465 = secure true

    secure: false,

    auth: {

      user: "jmulders@misterchameleon.nl",

      pass: "woqfi4-dekmov-Johfuj",

    },

  });

  try {

    console.log("Verifying connection...");

    await transporter.verify();

    console.log("✅ SMTP verbinding werkt");

    console.log("Sending test mail...");

    await transporter.sendMail({

      from: "jmulders@misterchameleon.nl",

      to: "jasper.mulders@gmail.com",

      subject: "SMTP test",

      text: "Dit is een testmail",

    });

    console.log("✅ Mail verzonden");

  } catch (err) {

    console.error("❌ SMTP fout:");

    console.error(err);

  }

}

test();