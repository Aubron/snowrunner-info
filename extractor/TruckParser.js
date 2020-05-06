const xmlConvert = require('xml-js');
const fs = require('fs');
const merge = require('deepmerge');
const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray

class TruckParser {
  // parseTruck takes a truck's XML representation, resolves inheritance, and returns an object representation of a truck.
  parseTruckXML = (truckPath) => {
    const truck = fs.readFileSync(truckPath);
    const truckJSON = JSON.parse(xmlConvert.xml2json(truck, { compact: true, spaces: 4 }));
    fs.writeFileSync('./output.json',JSON.stringify(truckJSON, null, '\t'))
    const templates = this.getTemplates(truckJSON);
    const result = this.resolveTemplates(truckJSON,'Root',templates);
    fs.writeFileSync('./output_expanded.json',JSON.stringify(result, null, '\t'));
    return result;
  }

  // getTemplates takes an object representation of a raw spintires xml file, and returns an object that can be used to resolve inheritance.
  getTemplates = (json) => {
    let output = {};
    // to resolve inheritance in the right order, we start by parsing the relevant template file. These are found in the _templates folder
    // _templates may have a "Include" attribute. This means to start with the templates present in that file.
    if (json._templates && json._templates._attributes && json._templates._attributes.Include) {
      const include = fs.readFileSync(`./data/_templates/${json._templates._attributes.Include}.xml`);
      const includeJSON = JSON.parse(xmlConvert.xml2json(include, { compact: true, spaces: 4 }));
      let includeObj = this.getTemplates(includeJSON);
      output = includeObj;
    }

    // second, resolve the local _templates object.
    // _templates seems to be a dual level object. The first level of the object designates the XML type that the template can be applied to
    // the second indicates the actual name of the template, and contains the attributes and whatnot to apply.
    if (json._templates) {
      // get all the xml node types represented in the template object.
      let keys = Object.keys(json._templates)
      for (let i = 0; i < keys.length; i += 1) {
        let key = keys[i];
        if (key !== "_attributes") {
          let template = json._templates[key];
          // if the key (XML node type) doesn't exist on the output, create it and initialize it with the template.
          if (!output[key]) {
            output[key] = template;
          } else {
            // otherwise, add the data to that object.
            let names = Object.keys(template)
            for (let j = 0; j < names.length; j += 1) {
              let name = names[j];
              let data = template[name];
              output[key][name] = data;
            }
          }
        }
      }
    }

    return output;
  }

  // resolveTemplates takes an object (probably a representation of a raw spintires xml file) and a templates object from getTemplates.
  // it resolves any _template references within, using those template definitions.
  resolveTemplates = (obj,nodeType,templates) => {
    // if it's an array (multiple xml nodes with the same name), run on all elements and return.
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i += 1) {
        obj[i] = this.resolveTemplates(obj[i],nodeType,templates);
      }
      return obj;
    }

    // otherwise we check all the attributes of the object and recurse
    let keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i += 1) {
      let key = keys[i];
      if (key !== "_attributes") {
        obj[key] = this.resolveTemplates(obj[key],key,templates);
      }
    }

    // finally, if the object has a _attributes property, and that property contains a _template, we merge it with the template object.
    if (obj._attributes && obj._attributes._template) {
      console.log(`found template on object ${nodeType}, using ${obj._attributes._template}`)
      console.log('old obj',obj);
      // look for a valid template
      if (templates[nodeType][obj._attributes._template]) {
        let template = templates[nodeType][obj._attributes._template];
        obj = merge(template,obj,{
          arrayMerge: overwriteMerge
        })
      }
      console.log('new obj',obj);
    }

    return obj;
  }
}

module.exports = TruckParser;