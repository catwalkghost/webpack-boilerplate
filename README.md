FrontEnd Basic Config

## Dependencies

Node (https://nodejs.org):

* MacOS: `brew install node`

GraphicsMagick (http://www.graphicsmagick.org):

* MacOS: `brew install graphicsmagick`

To run the `gulp` command, either do `npm i -g gulp`, or add the following to your `~/.profile` (or equivalent):

```sh
export PATH=$PATH:node_modules/.bin
```

## Development

```sh
cp .env.properties.example .env.properties

npm i

npm start
# or
gulp
```