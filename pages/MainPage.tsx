/** @jsxImportSource jsr:@mary/jsx */

export const MainPage = () => {
  return (
    <>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Department of Misinformation</title>
        </head>

        <body>
          <a href="/">
            <h1>Department of Misinformation</h1>
          </a>
          <p>
            There is currently only the test user{" "}
            <a href="/users/me1">
              <em>@me1</em>
            </a>.
          </p>
        </body>
      </html>
    </>
  );
};
