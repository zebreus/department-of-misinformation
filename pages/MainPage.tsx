/** @jsxImportSource jsr:@mary/jsx */

const Followers = (
  { followers, user }: { followers: string[]; user: string },
) => {
  return (
    <figure>
      <figcaption>Followers of {user}</figcaption>
      <ul>
        {followers.map((f) => <li>{f}</li>)}
      </ul>
    </figure>
  );
};

export const MainPage = ({ followers }: { followers: string[] }) => {
  return (
    <>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Department of Misinformation</title>
        </head>

        <body>
          <h1>Department of Misinformation</h1>
          <p>
            There is currently only the test user{" "}
            <em>me</em>. For now this page show info about that user
          </p>
          <Followers followers={followers} user="me" />
        </body>
      </html>
    </>
  );
};
