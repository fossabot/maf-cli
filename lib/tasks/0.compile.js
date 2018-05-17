'use strict'

const fs = require( 'fs' )
const path = require( 'path' )
const SourceMap = require( 'source-map' )
const SourceNode = SourceMap.SourceNode
const compiler = require( 'google-closure-compiler-js' ).compile
const formatter = require( '../util/closure-formatter-pretty' )
const storage = require( 'node-persist' )

const maf = require( '../maf' )
const ansi = require( '../util/ansi' )
const getSpinner = require( '../util/spinner' )

function compile( done ) { compileWrapper( done ) }

compile.description = `Compile your MAF App with the Closure Compiler. ${ansi.gray( `Runs automatically while using other tasks.` )}`

maf.task( compile )

function include( src, folder, sourceMap ) {
  const code = `${fs.readFileSync( src, `utf8` )}\n`

  return code.split( `\n` ).forEach( ( line, lineNr ) => {
    if ( /include\s*\(\s*["']([^'"\s]+)["']\s*\)/g.test( line ) )
      include( `${folder}/${/include\s*\(\s*["']([^'"\s]+)["']\s*\)/g.exec( line )[ 1 ]}`, folder, sourceMap )
    else
      sourceMap.add( new SourceNode( ++lineNr, 0, src, `${line}\n` ) )
  } )
}

async function compileWrapper( done ) {
  await storage.init( { dir: path.resolve( process.cwd(), `./.maf` ) } )

  const config = maf.config
  const file = require( path.resolve( process.cwd(), `./contents/metadata.json` ) ).scripts
  const contentsPath = path.resolve( process.cwd(), `./contents/` )
  const scriptPath = path.resolve( contentsPath, file )

  const sourceNode = new SourceNode()
  include( scriptPath, contentsPath, sourceNode )

  const sourceMap = sourceNode.toStringWithSourceMap( { file, sourceRoot: process.cwd() } )

  // console.log( sourceMap.map.toJSON() )
  // + '\n' + '//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + Buffer.from( sourceMap.map.toString() ).toString( 'base64' )

  const spinner = getSpinner( `Compiling` ).start()

  const out = compiler( {
    jsCode: [ {
      src: sourceMap.code
    , sourceMap: sourceMap.map.toJSON()
    , path: scriptPath
    } ]
  , createSourceMap: true
  , rewritePolyfills: false
  , languageIn: config && config.es6 ? `ES6` : `ES5`
  } )

  const messages = await formatter( out, sourceMap.map.toJSON() )

  // + '\n' + '//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + Buffer.from( out.sourceMap ).toString( 'base64' )
  spinner.succeed( `Compiling done` )

  if ( messages ) console.log( messages )

  await storage.setItem( `compiledcode`, out.compiledCode )

  // {
  //   messages
  // , code: out.compiledCode || sourceMap.code
  // , sourceMap: ( out.sourceMap.file && out.sourceMap.sources.length ) out.sourceMap : sourceMap.map.toJSON()
  // }

  done()
}