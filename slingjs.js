/**
 * sling.js v1.0
 * @author mike robinson <mike.robinson@gmail.com>
 */


/**
 * Creates a new SlingService
 * @constructor
 * @param path {String} A local or absolute path
 */
function SlingService(path) {
    this.path = this.getCurrentPath();

    if(_(path).hasValue()) {
        this.path =  this._makePath(path);
    }
}

/**
 * Change the starting path of the SlingService queries
 * @param path {String} A local or absolute path
 */
SlingService.prototype.setPath = function(path) {
    this.path = this._makePath(path);
};

/**
 * Get the starting path of the SlingService queries
 * @returns {String} An absolute path
 */
SlingService.prototype.getPath = function() {
    return this.path;
};

/**
 * Get the current URL location converted into a sling path.
 * @returns {String} An absolute path.
 */
SlingService.prototype.getCurrentPath = function() {
    var path = window.location.pathname;
    var pathIndex = path.indexOf(".html");

    if(pathIndex >= 0) {
        path = path.substring(0, pathIndex);
    }

    return path;
};

/**
 * Gets the node located at the current path of the SlingService.
 * @param [callback] {Function(status, node)} Function that returns a post status and SlingNode. SlingNode is null if unsuccessful.
 */
SlingService.prototype.getCurrentNode = function(callback) {
    this.getNode("", callback);
};

/**
 * Gets the node located at the request path. The path can be relative or absolute.
 * @param [callback] {Function(status, node)} Function that returns a status and SlingNode. SlingNode is null if unsuccessful.
 */
SlingService.prototype.getNode = function(path, callback) {
    var absolutePath = this._makePath(path);

    if(_(absolutePath).endsWith("/")) {
        absolutePath = absolutePath.substring(0, absolutePath.length - 1);    
    }
    
    SlingUtils.ajax({
        url: absolutePath + ".infinity.json",
        dataType: "json",

        statusCode: {
            200: function(response) {
                if(_(callback).isFunction()) {
                    var node = new SlingNode(absolutePath, response);
                    callback(response, node);
                }
            },
            300: function(response) {
                // JCR limit reached, array of JSON files returned
                var responseJSON = eval(response.responseText); // Convert string array to regular array

                SlingUtils.ajax({
                    url: responseJSON[0],
                    dataType: "json",
                    success: function(response) {
                        if(_(callback).isFunction()) {
                            var node = new SlingNode(absolutePath, response);
                            callback(response, node);
                        }
                    },
                    error: function(response) {
                        if(_(callback).isFunction()) {
                            callback(response, null);
                        }
                    }
                });
            },
            404: function(response) {
                if(_(callback).isFunction()) {
                    callback(response, null);
                }
            },
            412: function(response) {
                if(_(callback).isFunction()) {
                    callback(response, null);
                }
            },
            500: function(response) {
                if(_(callback).isFunction()) {
                    callback(response, null);
                }
            }


        }
    });
};

/**
 *
 * @param name {String} The name of the property to check for
 * @param [value] {String} The value of the property
 * @param [callback] {Function(status, nodes)} Function that returns a request status and list of nodes with the property. Array is null if unsuccessful.
 */
SlingService.prototype.getNodesByProperty = function(name, value, callback) {
    var that = this;
    var nodes = [];

    // Assume name and callback
    if(arguments.length == 2) {
        callback = value;
        value = null;
    }
        
    this.getCurrentNode(function(s, node) {
        if(s.status == 200 || node) {
            that._checkNodeForProperty(nodes, node, name, value);
            if(_(callback).isFunction()) {
                callback(s, nodes);
            }
        } else {
            if(_(callback).isFunction()) {
                callback(s, null);
            }
        }
    });
};

/**
 * Recursive function to check a node for a property 
 * @param list {Array} The list reference to attach matching nodes to
 * @param node {SlingNode} The node to check
 * @param name {String} The property name to check for
 * @param value {String} The property value to check for
 */
SlingService.prototype._checkNodeForProperty = function(list, node, name, value) {
    if(node.hasProperty(name, value)) {
        list.push(node);
    }

    var childNodes = node.getNodes();
    for(var i = 0; i < childNodes.length; i++) {
        this._checkNodeForProperty(list, childNodes[i], name, value);
    }
};

/**
 * Creates a node at the specified path.
 * @param path {String} The absolute or relative path to create the node at.
 * @param properties {Object} The properties to instantiate the node with.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.createNode = function(path, properties, callback) {
    var absolutePath = this._makePath(path);
    var node = new SlingNode(absolutePath, properties);
    
    var that = this;
    node.save(function(status) {
        that.getNode(absolutePath, callback);   
    });
};


/**
 * Performs a post to sling to perform a requested node action.
 * @param path {String} The absolute or relative path to post the actions to
 * @param actions {Object} The collection of Sling parameters to execute
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.nodeAction = function(path, actions, callback) {
    var data = this._makePost(actions);

    SlingUtils.ajax({
        url: this._makePath(path),
        data: data,
        type: 'POST',
        success: function(response) {
            if(_(callback).isFunction()) {
                callback(response);
            }
        },
       error: function(response) {
            if(_(callback).isFunction()) {
                callback(response);
            }
       }
    });
};

/**
 * Copies a value from at location over to the destination. The destination -cannot- exist previously.
 * @param path {String} The value to copy
 * @param destination {String} The path of the newly created value
 * @param [overwrite] {Boolean} Overwrite existing values. Defaults to true.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.copyValue = function(path, destination, overwrite, callback) {
    if(overwrite == null) overwrite = true;
    this.nodeAction(path, {"operation": "copy", "dest": destination, "replace": overwrite}, callback);
};

/**
 * Copies a collection of values over to the destination. The destination -must- exist previously.
 * @param paths {Array} The values to copy
 * @param destination {String} The path of the parent node hosting the copied values
 * @param [overwrite] {Boolean} Overwrite existing values. Defaults to true.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.copyValues = function(paths, destination, overwrite, callback) {
    this.nodeAction(this.path, {"operation": "copy", "applyTo": paths, "dest": destination, "replace": overwrite}, callback);
};

/**
 * Moves a value from at location over to the destination. The destination -cannot- exist previously.
 * @param path {String} The value to move.
 * @param destination {String} The path of the newly created value.
 * @param [overwrite] {Boolean} Overwrite existing values. Defaults to true.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.moveValue = function(path, destination, overwrite, callback) {
    this.nodeAction(path, {"operation": "move", "dest": destination, "replace": overwrite}, callback);
};

/**
 * Moves a collection of values over to the destination. The destination -must- exist previously.
 * @param paths {Array} The values to move.
 * @param destination {String} The path of the parent node hosting the moved values.
 * @param [overwrite] {Boolean} Overwrite existing values. Defaults to true.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.moveValues = function(paths, destination, overwrite, callback) {
    this.nodeAction(this.path, {"operation": "move", "applyTo": paths, "dest": destination, "replace": overwrite}, callback);
};

/**
 * Deletes a value at the specified path.
 * @param path {String} The value to delete.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.deleteValue = function(path, callback) {
    this.nodeAction(path, {"operation": "delete"}, callback);
};

/**
 * Deletes a collection of values at the specified paths.
 * @param paths {Array} The values to delete.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.deleteValues = function(paths, callback) {
    this.nodeAction(this.path, {"operation": "delete", "applyTo": paths}, callback);
};

/**
 *
 * @param path
 * @param values
 * @param overwriteNodes
 * @param overwriteProperties
 * @param callback
 */
SlingService.prototype.importValues = function(path, values, overwriteNodes, overwriteProperties, callback) {
    this.nodeAction(path, {"operation": "import", "content": values, "contentType": "json", "replace": overwriteNodes, "replaceProperties": overwriteProperties}, callback);
};


/**
 * Reorders a node in front of its siblings.
 * @param path {String} The node to reorder.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.orderNodeFirst = function(path, callback) {
    this.nodeAction(path, {"order": "first"}, callback);
};

/**
 * Reorders a node after its siblings.
 * @param path {String} The node to reorder.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.orderNodeLast = function(path, callback) {
    this.nodeAction(path, {"order": "first"}, callback);
};

/**
 * Reorders a node in front of a specified sibling.
 * @param path {String} The node to reorder.
 * @param sibling {String} The sibling to place the node in front of.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.orderNodeBefore = function(path, sibling, callback) {
    this.nodeAction(path, {"order": "before " + sibling}, callback);
};

/**
 * Reorders a node in after a specified sibling.
 * @param path {String} The node to reorder.
 * @param sibling {String} The sibling to place the node after.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.orderNodeAfter = function(path, sibling, callback) {
    this.nodeAction(path, {"order": "after " + sibling}, callback);
};

/**
 * Reorders a node to a specific location, zero-indexed.
 * @param path {String} The node to reorder.
 * @param position {Number} The zero-index location to place the node.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingService.prototype.orderNodeAt = function(path, position, callback) {
    this.nodeAction(path, {"order": position}, callback);
};


/**
 * Generates a path based on the stored path and a passed parameters.
 * @param path {String} A relative or absolute path.
 */
SlingService.prototype._makePath = function(path) {
    if(!_(this.path).hasValue()) {
        return path;
    } else {
        // Absolute path, do nothing
        if(_(path).startsWith("/")) {
            return path;
        } else {
            if(_(this.path).endsWith("/")) {
                return this.path + path;
            } else {
                return this.path + "/" + path;
            }
        }
    }
};

/**
 * Converts an object into a form post string
 * @param actions {Object} The sling actions to include in the post
 * @param actions.order The Sling :order parameter, used to reorder nodes
 * @param actions.dest The Sling :dest parameter, used to specify a destination for nodes
 * @param actions.operation The Sling :operation parameter, used to specify an action
 * @param actions.replace The Sling :replace parameter, used to specify if nodes should be replaced during an action
 * @param actions.replaceProperties The Sling :replaceProperties parameter, used to specify if properties should be replaced during an action
 * @param actions.applyTo The Sling :applyTo parameter, used to specify which nodes to apply the action to
 * @returns {String} The post string
 */
SlingService.prototype._makePost = function(actions) {
    //order, dest, operation, applyTo
    var post = [];
    if(_(actions.order).hasValue()) {
        post.push(":order=" + actions.order);
    }

    if(_(actions.dest).hasValue()) {
        post.push(":dest=" + this._makePath(actions.dest));
    }

    if(_(actions.operation).hasValue()) {
        post.push(":operation=" + actions.operation);
    }


    if(_(actions.nameHint).hasValue()) {
        post.push(":nameHint=" + actions.nameHint);
    }

    if(_(actions.checkin).hasValue()) {
        post.push(":checkin=" + actions.checkin);
    }

    if(_(actions.content).hasValue()) {
        post.push(":content=" + actions.content);
    }

    if(_(actions.contentType).hasValue()) {
        post.push(":contentType=" + actions.contentType);
    }

    if(_(actions.replace).hasValue()) {
        post.push(":replace=" + actions.replace);
    }

    if(_(actions.replace).hasValue()) {
        post.push(":replaceProperties=" + actions.replaceProperties);
    }

    if(_(actions.applyTo).hasValue()) {
        var applyTo = actions.applyTo;

        if(_(applyTo).isString()) {
            applyTo = [applyTo];
        }

        for(var i = 0; i < applyTo.length; i++) {
            post.push(":applyTo=" + this._makePath(applyTo[i]));
        }
    }


    return post.join("&");
};


/**
 * Creates a new SlingNode
 * @constructor
 * @requires SlingProperty
 * @param path {String} The path of the node
 * @param properties {String} The properties to assign to the node
 */
function SlingNode(path, properties) {
    this.path = path;
    this.name = _(path.split("/")).last();
    this.properties = {};
    this.nodes = [];
    this.ignoreProperties = ["jcr:uuid", "jcr:created", "jcr:predecessors", "jcr:createdBy", "jcr:mixinTypes", "jcr:baseVersion", "jcr:versionHistory", "jcr:versionHistory"];

    if(_(properties).hasValue()) {
        for(var i in properties) {
            if(_(properties[i]).isString() || _(properties[i]).isArray()) {
                this.properties[i] = new SlingProperty(path + "/"  + i, i, properties[i]);
            } else if(typeof properties[i] == "object") {
                this.nodes.push(new SlingNode(path + "/" + i, properties[i]));
            }
        }
    }
}

/**
 * @returns {String} The local name of the node
 */
SlingNode.prototype.getName = function(){
    return this.name;
}

/**
 * @returns {String} The absolute path of the node
 */
SlingNode.prototype.getPath = function() {
    return this.path;
};

/**
 * Sets the absolute path of the node. Changing the path and saving on existing nodes will cause a new node to be created with this nodes properties.
 * @param path
 */
SlingNode.prototype.setPath = function(path) {
    this.path = path;
};

/**
 * @returns {Object} The collection of node properties. Returns an empty object if there are no properties.
 */
SlingNode.prototype.getProperties = function() {
    return this.properties;
};

/**
 * @returns {Object} A key / value collection of properties and their values
 */
SlingNode.prototype.getValues = function() {
    var values = {};
    for(var i in this.properties) {
        values[i] = this.properties[i].getValue();
    }
    return values;
}

/**
 * @param name The name of the property
 * @param [value] The value of the property
 * @returns {Boolean}
 */
SlingNode.prototype.hasProperty = function(name, value) {
    if(this.getProperty(name) != null) {
        return (value != null) ? (value == this.getProperty(name).getValue()) : true;
    } else {
        return false;
    }
};
   
/**
 * @param name {String} The name of the property
 * @requires SlingProperty
 * @returns {Object} The child property, instantiated as a SlingProperty. Returns null if there is no value.
 *
 */
SlingNode.prototype.getProperty = function(name) {
    if(typeof this.properties[name] != "undefined") {
        return this.properties[name];
    } else {
        return null;
    }
};

/**
 * Sets a property on a node. If a property with the same name already exists, it will be overwritten.
 * @param name {String} The name of the property
 * @param value {String|String[]|Number|Number[]|Boolean|Boolean[]} The value of the property
 */
SlingNode.prototype.setProperty = function(name, value) {
    this.properties[name] = new SlingProperty(this.path + "/" + name, name, value);
};

/**
 * @returns {Object[]} The collection of child nodes, each instantiated as a SlingNode. Returns an empty array is there are no child nodes.
 */
SlingNode.prototype.getNodes = function() {
    return this.nodes;
};

/**
 * Saves a node. If a node with the same path already exists, it will be modified.
 * @param [callback] {Function(status)} Function that returns a post status.
 */
SlingNode.prototype.save = function(callback) {
    var that = this;
    
    SlingUtils.ajax({
        url: this.path,
        data: this.serialize(),
        type: 'POST',
        success: function(response) {
            if(_(callback).isFunction()) {
                callback(response);
            }
        },
        error: function(response) {
            if(_(callback).isFunction()) {
                callback(response);
            }
        }
    });
};

/**
 * Converts the SlingNode to a JSON object
 * @returns {Object} The JSON representation of the current node
 */
SlingNode.prototype.toJSON = function() {
    var data = {};
    for(var i in this.properties) {
        data[i] = this.properties[i].value;
    }

    for(var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        data[node.getName()] = node.toJSON();
    }
    
    return data;
};

/**
 * Converts the SlingNode into a POST string
 * @returns {String} The post
 */
SlingNode.prototype.serialize = function() {
    var data = [];

    for(var i in this.properties) {

        if(_(this.ignoreProperties).indexOf(i) < 0) {
            var prop = this.properties[i];

            if(_(prop.value).isArray()) {
                _(prop.value).each(function(value) {
                    data.push(i + "=" + encodeURIComponent(value));
                });
                data.push(i + "@TypeHint=" + prop.typeHint);
            } else {
                data.push(i + "=" + encodeURIComponent(prop.value));
            }


            if(!_(this.properties[i].typeHint).isEmpty()) {
                data[i + "@TypeHint"] = this.properties[i].typeHint;
            }
        }
    }

    return data.join("&");
};

/**
 * Shorthand function for setting and retrieving attribute values
 * @param name {String} The name of the property
 * @param value {String|String[]|Number|Number[]|Boolean|Boolean[]} The value of the property
 */
SlingNode.prototype.val = function(name, value) {
    if(typeof value == "undefined") {
        // GET
        var property = this.getProperty(name);
        if(property != null) {
            return property.getValue();             
        }
    } else {
        // SET
        this.setProperty(name, value);
    }
}

/**
 * Creates a new SlingAttribute. If the value passed is an array, automatically assigns a Sling TypeHint to the attribute.
 * @constructor
 * @param name {String} The name of the property
 * @param value {String|String[]|Number|Number[]|Boolean|Boolean[]} The value of the property
 */
function SlingProperty(path, name, value) {
    this.path = path;
    this.name = name;
    this.value = value;
    this.typeHint = "";

    if(_(value).isArray()) {
        this.typeHint = "String[]";
    }
}

SlingProperty.prototype.getPath = function() {
    return this.path;
};

SlingProperty.prototype.getName = function() {
    return this.name;
};

SlingProperty.prototype.getValue = function() {
    return this.value;
};

SlingProperty.prototype.getTypeHint = function() {
    return this.typeHint;
};


/**
 * Utility functions
 */
var SlingUtils = function() {
    /**
     * Private function for generating an HTTPRequest in different browsers.
     * Borrowed from: http://eloquentjavascript.net/chapter14.html
     */
    function makeHttpObject() {
        try {return new XMLHttpRequest()}
        catch (error) {}
        try {return new ActiveXObject("Msxml2.XMLHTTP")}
        catch (error) {}
        try {return new ActiveXObject("Microsoft.XMLHTTP")}
        catch (error) {}

        throw new Error("Could not create HTTP request object.");
    }

    /**
     * Handler for generating HTTPRequests
     */
    function ajax(params) {
        var request = makeHttpObject();

        var type = (params.type != null) ? params.type : "GET";
        request.open(type, params.url, true);
        if(type == "GET") {
            request.send(null);
        } else {
            // set the necessary request headers
            request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            if(params.data != null) {
                request.setRequestHeader("Content-length", params.data.length); 
            } else {
                request.setRequestHeader("Content-length", 0);
            }
            
            request.setRequestHeader("Connection", "close");  
            request.send(params.data);
        }
        
        request.onreadystatechange = function() {
            if (request.readyState == 4) {            
                var handler = null;
                if(_(params.statusCode).hasValue()) {
                    var handler = params["statusCode"][request.status];
                }
                if(!_(handler).hasValue()) {
                    handler = (request.status == 200) ? params["success"] : params["error"];
                }
                
                if(_(handler).isFunction()) {
                    if(request.status >= 200 && request.status < 300) {
                        var response = request.responseText;
                        if(params.dataType && params.dataType.toLowerCase() == "json") {
                            response = eval("(" + response + ")");
                        }
                        handler(response);
                    } else {
                        handler(request);
                    }
                }
            }
        }
    }

    return {
        ajax: ajax
    }
}();