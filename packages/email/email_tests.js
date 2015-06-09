var streamBuffers = Npm.require('stream-buffers');

Tinytest.add("email - dev mode smoke test", function (test) {
  // This only tests dev mode, so don't run the test if this is deployed.
  if (process.env.MAIL_URL) return;

  try {
    var stream = new streamBuffers.WritableStreamBuffer;
    EmailTest.overrideOutputStream(stream);
    Email.send({
      from: "foo@example.com",
      to: "bar@example.com",
      cc: ["friends@example.com", "enemies@example.com"],
      subject: "This is the subject",
      text: "This is the body\nof the message\nFrom us.",
      headers: {'X-Meteor-Test': 'a custom header'}
    });
    // XXX brittle if mailcomposer changes header order, etc
    test.equal(stream.getContentsAsString("utf8"),
               "====== BEGIN MAIL #0 ======\n" +
               "(Mail not sent; to enable sending, set the MAIL_URL " +
                 "environment variable.)\n" +
               "MIME-Version: 1.0\r\n" +
               "X-Meteor-Test: a custom header\r\n" +
               "From: foo@example.com\r\n" +
               "To: bar@example.com\r\n" +
               "Cc: friends@example.com, enemies@example.com\r\n" +
               "Subject: This is the subject\r\n" +
               "Content-Type: text/plain; charset=utf-8\r\n" +
               "Content-Transfer-Encoding: quoted-printable\r\n" +
               "\r\n" +
               "This is the body\r\n" +
               "of the message\r\n" +
               "From us.\r\n" +
               "====== END MAIL #0 ======\n");

    // Test direct MailComposer usage.
    var mc = new EmailInternals.NpmModules.mailcomposer.module.MailComposer;
    mc.setMessageOption({
      from: "a@b.com",
      text: "body"
    });
    Email.send({mailComposer: mc});
    test.equal(stream.getContentsAsString("utf8"),
               "====== BEGIN MAIL #1 ======\n" +
               "(Mail not sent; to enable sending, set the MAIL_URL " +
                 "environment variable.)\n" +
               "MIME-Version: 1.0\r\n" +
               "From: a@b.com\r\n" +
               "Content-Type: text/plain; charset=utf-8\r\n" +
               "Content-Transfer-Encoding: quoted-printable\r\n" +
               "\r\n" +
               "body\r\n" +
               "====== END MAIL #1 ======\n");
  } finally {
    EmailTest.restoreOutputStream();
  }
});

var emailParams = {
  from: "a@b.com",
  text: "body"
};

Tinytest.add("email - setMailURL dev mod smokey test", function (test) {
  try {
    var stream = new streamBuffers.WritableStreamBuffer;
    EmailTest.overrideOutputStream(stream);

    // Test MAIL_URL overriding
    Email.setMailURL('smtp://user:pass!@smtp.domain.com:465');
    try {
      Email.send(emailParams);
    } catch (e) {
      test.equal(e.message,
                  'Invalid login - 535 Incorrect authentication data');
    }
    // Test default MAIL_URL restoration if falsey argument passed
    Email.setMailURL(false);
    Email.send(emailParams);
    test.equal(stream.getContentsAsString("utf8"),
               "====== BEGIN MAIL #0 ======\n" +
               "(Mail not sent; to enable sending, set the MAIL_URL " +
                 "environment variable.)\n" +
               "MIME-Version: 1.0\r\n" +
               "From: a@b.com\r\n" +
               "Content-Type: text/plain; charset=utf-8\r\n" +
               "Content-Transfer-Encoding: quoted-printable\r\n" +
               "\r\n" +
               "body\r\n" +
               "====== END MAIL #0 ======\n");
  } finally {
    EmailTest.restoreOutputStream();
  }
});

Tinytest.add("email - setMailURL memory usage test", function (test) {

  var heapUsedBefore = process.memoryUsage().heapUsed;

  var cycleTimes = 1000;

  for (var i = 0; i < cycleTimes; i++) {
    Email.setMailURL(i % 2 ? false : 'smtp://user:pass!@smtp.domain.com:465');
    EmailTest.makePool();
  }

  test.isTrue(heapUsedBefore > process.memoryUsage().heapUsed / 1.5,
               "process.memoryUsage().heapUsed is 1.5 times " +
               "higher after " + cycleTimes + " makePool recreation " +
               "attempts. Is there some sort of memory leak?");
});
