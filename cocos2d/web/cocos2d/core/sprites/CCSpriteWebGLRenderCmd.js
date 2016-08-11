/****************************************************************************
 Copyright (c) 2013-2014 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

//Sprite's WebGL render command
(function() {

    var _resetPointers = true;

    cc.Sprite.WebGLRenderCmd = function (renderable) {
        cc.Node.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;

        this._vertices = [
            {x: 0, y: 0, z: 0}, // tl
            {x: 0, y: 0, z: 0}, // bl
            {x: 0, y: 0, z: 0}, // tr
            {x: 0, y: 0, z: 0}  // br
        ];
        var length = this.vertexBytesPerUnit;
        var bufInfo = cc.renderer.requestBuffer(length);
        this._buffer = bufInfo.buffer;
        this._bufferOffset = bufInfo.offset;
        this._quad = new cc.V3F_C4B_T2F_Quad(null, null, null, null, this._buffer.data, this._bufferOffset);
        this._float32View = new Float32Array(this._buffer.data, this._bufferOffset, length / 4);
        this._uint32View = new Uint32Array(this._buffer.data, this._bufferOffset, length / 4);
        
        // Separated webgl buffer implementation
        // this._buffer = new ArrayBuffer(length);
        // this._bufferOffset = 0;
        // this._quad = new cc.V3F_C4B_T2F_Quad(null, null, null, null, this._buffer, this._bufferOffset);
        // this._float32View = new Float32Array(this._buffer, this._bufferOffset, length / 4);
        // this._uint32View = new Uint32Array(this._buffer, this._bufferOffset, length / 4);
        // // Init buffer
        // var gl = cc._renderContext;
        // this._glBuffer = gl.createBuffer();
        // gl.bindBuffer(gl.ARRAY_BUFFER, this._glBuffer);
        // gl.bufferData(gl.ARRAY_BUFFER, length, gl.DYNAMIC_DRAW);

        this._dirty = false;
        this._bufferDirty = false;
        this._recursiveDirty = false;
        this._vBuffer = null;
        this._vertexOffset = 0;

        if (!proto.batchShader) {
            proto.batchShader = cc.shaderCache.programForKey(cc.SHADER_SPRITE_POSITION_TEXTURECOLORALPHATEST);
        }
    };

    var proto = cc.Sprite.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    proto.constructor = cc.Sprite.WebGLRenderCmd;

    // The following static properties must be provided for a auto batchable command
    proto.vertexBytesPerUnit = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
    proto.bytesPerUnit = proto.vertexBytesPerUnit;
    proto.indicesPerUnit = 6;
    proto.verticesPerUnit = 4;
    proto._supportBatch = true;

    proto.batchShader = null;

    proto.getBatchInfo = function (info) {
        info.texture = this._node._texture;
        info.blendSrc = this._node._blendFunc.src;
        info.blendDst = this._node._blendFunc.dst;
        info.shader = this.batchShader;
    };

    proto._invalidBatch = function () {
        if (this._vBuffer) {
            this._vBuffer.valid = false;
        }
    };

    proto.updateBuffer = function () {
        if (!this._buffer) {
            var length = this.vertexBytesPerUnit;
            var bufInfo = cc.renderer.requestBuffer(length);
            this._buffer = bufInfo.buffer;
            this._bufferOffset = bufInfo.offset;
            this._quad = new cc.V3F_C4B_T2F_Quad(null, null, null, null, this._buffer.data, this._bufferOffset);
            this._float32View = new Float32Array(this._quad.arrayBuffer, this._bufferOffset, length / 4);
            this._uint32View = new Uint32Array(this._quad.arrayBuffer, this._bufferOffset, length / 4);
            
            this._setTextureCoords(this._node._rect);
            this._updateColor();
            this._updateVertexBuffer();
        }
    };

    proto.freeBuffer = function () {
        if (this._buffer) {
            this._buffer.freeBuffer(this._bufferOffset, this.vertexBytesPerUnit);
            this._buffer = null;
            this._bufferOffset = 0;
            this._quad = null;
            this._float32View = null;
        }
    };

    proto.updateBlendFunc = function (blendFunc) {};

    proto.setDirtyFlag = function(dirtyFlag){
        cc.Node.WebGLRenderCmd.prototype.setDirtyFlag.call(this, dirtyFlag);
        this._dirty = true;
    };

    proto.setDirtyRecursively = function (value) {
        this._recursiveDirty = value;
        this._dirty = value;
        // recursively set dirty
        var locChildren = this._node._children, child, l = locChildren ? locChildren.length : 0;
        for (var i = 0; i < l; i++) {
            child = locChildren[i];
            (child instanceof cc.Sprite) && child._renderCmd.setDirtyRecursively(value);
        }
    };

    proto._setBatchNodeForAddChild = function (child) {
        var node = this._node;
        if (node._batchNode) {
            if (!(child instanceof cc.Sprite)) {
                cc.log(cc._LogInfos.Sprite_addChild);
                return false;
            }
            if (child.texture._webTextureObj !== node.textureAtlas.texture._webTextureObj)
                cc.log(cc._LogInfos.Sprite_addChild_2);

            //put it in descendants array of batch node
            node._batchNode.appendChild(child);
            if (!node._reorderChildDirty)
                node._setReorderChildDirtyRecursively();
        }
        return true;
    };

    proto._handleTextureForRotatedTexture = function (texture) {
        return texture;
    };

    proto.isFrameDisplayed = function (frame) {
        var node = this._node;
        return (cc.rectEqualToRect(frame.getRect(), node._rect) && frame.getTexture().getName() === node._texture.getName()
            && cc.pointEqualToPoint(frame.getOffset(), node._unflippedOffsetPositionFromCenter));
    };

    proto._init = function () {
        this.updateBuffer();
        var tempColor = {r: 255, g: 255, b: 255, a: 255}, quad = this._quad;
        quad.bl.colors = tempColor;
        quad.br.colors = tempColor;
        quad.tl.colors = tempColor;
        quad.tr.colors = tempColor;
        this._bufferDirty = true;
        this._buffer.setDirty();
    };

    proto._resetForBatchNode = function () {
        var node = this._node;
        var x1 = node._offsetPosition.x;
        var y1 = node._offsetPosition.y;
        var x2 = x1 + node._rect.width;
        var y2 = y1 + node._rect.height;
        var vertices = this._vertices;
        vertices[0].x = x1; vertices[0].y = y2; // tl
        vertices[1].x = x1; vertices[1].y = y1; // bl
        vertices[2].x = x2; vertices[2].y = y2; // tr
        vertices[3].x = x2; vertices[3].y = y1; // br
        this._bufferDirty = true;
        if (this._buffer) {
            this._buffer.setDirty();
        }
    };

    proto.getQuad = function () {
        return this._quad;
    };

    proto._updateForSetSpriteFrame = function () {};

    proto._spriteFrameLoadedCallback = function (spriteFrame) {
        this.setTextureRect(spriteFrame.getRect(), spriteFrame.isRotated(), spriteFrame.getOriginalSize());
        this.dispatchEvent("load");
    };

    proto._textureLoadedCallback = function (sender) {
        var renderCmd = this._renderCmd;
        if (this._textureLoaded)
            return;

        this._textureLoaded = true;
        var locRect = this._rect;
        if (!locRect) {
            locRect = cc.rect(0, 0, sender.width, sender.height);
        } else if (cc._rectEqualToZero(locRect)) {
            locRect.width = sender.width;
            locRect.height = sender.height;
        }

        this.texture = sender;
        this.setTextureRect(locRect, this._rectRotated);

        // by default use "Self Render".
        // if the sprite is added to a batchnode, then it will automatically switch to "batchnode Render"
        this.setBatchNode(this._batchNode);
        this.dispatchEvent("load");
    };

    proto._setTextureCoords = function (rect, needConvert) {
        if (needConvert === undefined)
            needConvert = true;
        if (needConvert)
            rect = cc.rectPointsToPixels(rect);
        var node = this._node, locQuad = this._quad;

        var tex = node._batchNode ? node.textureAtlas.texture : node._texture;
        if (!tex || !locQuad)
            return;

        var atlasWidth = tex.pixelsWidth;
        var atlasHeight = tex.pixelsHeight;

        var left, right, top, bottom, tempSwap;
        if (node._rectRotated) {
            if (cc.FIX_ARTIFACTS_BY_STRECHING_TEXEL) {
                left = (2 * rect.x + 1) / (2 * atlasWidth);
                right = left + (rect.height * 2 - 2) / (2 * atlasWidth);
                top = (2 * rect.y + 1) / (2 * atlasHeight);
                bottom = top + (rect.width * 2 - 2) / (2 * atlasHeight);
            } else {
                left = rect.x / atlasWidth;
                right = (rect.x + rect.height) / atlasWidth;
                top = rect.y / atlasHeight;
                bottom = (rect.y + rect.width) / atlasHeight;
            }

            if (node._flippedX) {
                tempSwap = top;
                top = bottom;
                bottom = tempSwap;
            }

            if (node._flippedY) {
                tempSwap = left;
                left = right;
                right = tempSwap;
            }

            locQuad.bl.texCoords.u = left;
            locQuad.bl.texCoords.v = top;
            locQuad.br.texCoords.u = left;
            locQuad.br.texCoords.v = bottom;
            locQuad.tl.texCoords.u = right;
            locQuad.tl.texCoords.v = top;
            locQuad.tr.texCoords.u = right;
            locQuad.tr.texCoords.v = bottom;
        } else {
            if (cc.FIX_ARTIFACTS_BY_STRECHING_TEXEL) {
                left = (2 * rect.x + 1) / (2 * atlasWidth);
                right = left + (rect.width * 2 - 2) / (2 * atlasWidth);
                top = (2 * rect.y + 1) / (2 * atlasHeight);
                bottom = top + (rect.height * 2 - 2) / (2 * atlasHeight);
            } else {
                left = rect.x / atlasWidth;
                right = (rect.x + rect.width) / atlasWidth;
                top = rect.y / atlasHeight;
                bottom = (rect.y + rect.height) / atlasHeight;
            }

            if (node._flippedX) {
                tempSwap = left;
                left = right;
                right = tempSwap;
            }

            if (node._flippedY) {
                tempSwap = top;
                top = bottom;
                bottom = tempSwap;
            }

            locQuad.bl.texCoords.u = left;
            locQuad.bl.texCoords.v = bottom;
            locQuad.br.texCoords.u = right;
            locQuad.br.texCoords.v = bottom;
            locQuad.tl.texCoords.u = left;
            locQuad.tl.texCoords.v = top;
            locQuad.tr.texCoords.u = right;
            locQuad.tr.texCoords.v = top;
        }
        this._bufferDirty = true;
        this._buffer.setDirty();
    };

    proto._updateVertexBuffer = function () {
        if (this._buffer) {
            var mat = this._stackMatrix.mat,
                vertices = this._vertices,
                buffer = this._float32View,
                i, x, y, offset = 0,
                row = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT / 16;

            for (i = 0; i < 4; ++i) {
                x = vertices[i].x;
                y = vertices[i].y;
                buffer[offset] = x * mat[0] + y * mat[4] + mat[12];
                buffer[offset+1] = x * mat[1] + y * mat[5] + mat[13];
                buffer[offset+2] = mat[14];
                offset += row;
            }

            this._bufferDirty = true;
            this._buffer.setDirty();
        }
    };

    proto.transform = function (parentCmd, recursive) {
        cc.Node.WebGLRenderCmd.prototype.transform.call(this, parentCmd, recursive);

        this._updateVertexBuffer();
        this._dirty = true;     //use for batching
        this._savedDirtyFlag = true;
    };

    proto._setColorDirty = function () {};

    proto._updateColor = function () {
        var locDisplayedColor = this._displayedColor, locDisplayedOpacity = this._displayedOpacity, node = this._node;
        var color4 = {r: locDisplayedColor.r, g: locDisplayedColor.g, b: locDisplayedColor.b, a: locDisplayedOpacity};
        // special opacity for premultiplied textures
        if (node._opacityModifyRGB) {
            color4.r *= locDisplayedOpacity / 255.0;
            color4.g *= locDisplayedOpacity / 255.0;
            color4.b *= locDisplayedOpacity / 255.0;
        }
        var locQuad = this._quad;
        if (locQuad) {
            locQuad.bl.colors = color4;
            locQuad.br.colors = color4;
            locQuad.tl.colors = color4;
            locQuad.tr.colors = color4;
            this._buffer.setDirty();
        }

        // renders using Sprite Manager
        if (node._batchNode) {
            if (node.atlasIndex !== cc.Sprite.INDEX_NOT_INITIALIZED) {
                node.textureAtlas.updateQuad(locQuad, node.atlasIndex);
            } else {
                // no need to set it recursively
                // update dirty_, don't update recursiveDirty_
                this._dirty = true;
            }
        }
        this._bufferDirty = true;
    };

    proto._updateBlendFunc = function () {
        if (this._batchNode) {
            cc.log(cc._LogInfos.Sprite__updateBlendFunc);
            return;
        }

        // it's possible to have an untextured sprite
        var node = this._node,
            blendFunc = node._blendFunc;
        if (!node._texture || !node._texture.hasPremultipliedAlpha()) {
            if (blendFunc.src === cc.ONE && blendFunc.dst === cc.BLEND_DST) {
                blendFunc.src = cc.SRC_ALPHA;
            }
            node.opacityModifyRGB = false;
        } else {
            if (blendFunc.src === cc.SRC_ALPHA && blendFunc.dst === cc.BLEND_DST) {
                blendFunc.src = cc.ONE;
            }
            node.opacityModifyRGB = true;
        }
        this._invalidBatch();
    };

    proto._setTexture = function (texture) {
        var node = this._node;
        // If batchnode, then texture id should be the same
        if (node._batchNode) {
            if(node._batchNode.texture !== texture){
                cc.log(cc._LogInfos.Sprite_setTexture);
                return;
            }
        } else {
            if(node._texture !== texture){
                node._textureLoaded = texture ? texture._textureLoaded : false;
                node._texture = texture;
                // This will invalid current batch
                this._updateBlendFunc();
            }
        }

        if (texture)
            this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_SPRITE_POSITION_TEXTURECOLORALPHATEST);
        else
            this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_SPRITE_POSITION_COLOR);
    };

    proto.updateTransform = function () {                                    //called only at batching.
        var _t = this, node = this._node;

        // recalculate matrix only if it is dirty
        if (this._dirty) {
            var locQuad = _t._quad, locParent = node._parent;
            // If it is not visible, or one of its ancestors is not visible, then do nothing:
            if (!node._visible || ( locParent && locParent !== node._batchNode && locParent._shouldBeHidden)) {
                locQuad.br.vertices = locQuad.tl.vertices = locQuad.tr.vertices = locQuad.bl.vertices = {x: 0, y: 0, z: 0};
                node._shouldBeHidden = true;
            } else {
                node._shouldBeHidden = false;
                if(this._dirtyFlag !== 0){    //because changing color and opacity uses dirty flag at visit, but visit doesn't call at batching.
                    this.updateStatus();
                    this._dirtyFlag = 0;
                }

                if (!locParent || locParent === node._batchNode) {
                    node._transformToBatch = _t.getNodeToParentTransform();
                } else {
                    node._transformToBatch = cc.affineTransformConcat(_t.getNodeToParentTransform(), locParent._transformToBatch);
                }

                //
                // calculate the Quad based on the Affine Matrix
                //
                var locTransformToBatch = node._transformToBatch;
                var rect = node._rect;
                var x1 = node._offsetPosition.x;
                var y1 = node._offsetPosition.y;

                var x2 = x1 + rect.width;
                var y2 = y1 + rect.height;
                var x = locTransformToBatch.tx;
                var y = locTransformToBatch.ty;

                var cr = locTransformToBatch.a;
                var sr = locTransformToBatch.b;
                var cr2 = locTransformToBatch.d;
                var sr2 = -locTransformToBatch.c;
                var ax = x1 * cr - y1 * sr2 + x;
                var ay = x1 * sr + y1 * cr2 + y;

                var bx = x2 * cr - y1 * sr2 + x;
                var by = x2 * sr + y1 * cr2 + y;

                var cx = x2 * cr - y2 * sr2 + x;
                var cy = x2 * sr + y2 * cr2 + y;

                var dx = x1 * cr - y2 * sr2 + x;
                var dy = x1 * sr + y2 * cr2 + y;

                var locVertexZ = node._vertexZ;
                if (!cc.SPRITEBATCHNODE_RENDER_SUBPIXEL) {
                    ax = 0 | ax;
                    ay = 0 | ay;
                    bx = 0 | bx;
                    by = 0 | by;
                    cx = 0 | cx;
                    cy = 0 | cy;
                    dx = 0 | dx;
                    dy = 0 | dy;
                }
                locQuad.bl.vertices = {x: ax, y: ay, z: locVertexZ};
                locQuad.br.vertices = {x: bx, y: by, z: locVertexZ};
                locQuad.tl.vertices = {x: dx, y: dy, z: locVertexZ};
                locQuad.tr.vertices = {x: cx, y: cy, z: locVertexZ};
            }
            node.textureAtlas.updateQuad(locQuad, node.atlasIndex);
            node._recursiveDirty = false;
            this._dirty = false;
        }

        // recursively iterate over children
        if (node._hasChildren)
            node._arrayMakeObjectsPerformSelector(node._children, cc.Node._stateCallbackType.updateTransform);

        /*if (cc.SPRITE_DEBUG_DRAW) {               //TODO
            // draw bounding box
            var vertices = [
                cc.p(_t._quad.bl.vertices.x, _t._quad.bl.vertices.y),
                cc.p(_t._quad.br.vertices.x, _t._quad.br.vertices.y),
                cc.p(_t._quad.tr.vertices.x, _t._quad.tr.vertices.y),
                cc.p(_t._quad.tl.vertices.x, _t._quad.tl.vertices.y)
            ];
            cc._drawingUtil.drawPoly(vertices, 4, true);
        }*/
    };

    proto._checkTextureBoundary = function (texture, rect, rotated) {
        if (texture && texture.url) {
            var _x, _y;
            if (rotated) {
                _x = rect.x + rect.height;
                _y = rect.y + rect.width;
            } else {
                _x = rect.x + rect.width;
                _y = rect.y + rect.height;
            }
            if (_x > texture.width) {
                cc.error(cc._LogInfos.RectWidth, texture.url);
            }
            if (_y > texture.height) {
                cc.error(cc._LogInfos.RectHeight, texture.url);
            }
        }
    };

    proto.needDraw = function () {
        return (this._buffer && this._node._texture);
    };

    proto.rendering = function (ctx) {
        var node = this._node, locTexture = node._texture;
        if (!this._buffer || (locTexture && (!locTexture._textureLoaded || !node._rect.width || !node._rect.height)) || !this._displayedOpacity)
            return;

        var gl = ctx || cc._renderContext;
        //cc.assert(!_t._batchNode, "If cc.Sprite is being rendered by cc.SpriteBatchNode, cc.Sprite#draw SHOULD NOT be called");

        var program = this._shaderProgram;
        if (locTexture) {
            if (locTexture._textureLoaded) {
                program.use();
                program._updateProjectionUniform();

                cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
                //optimize performance for javascript
                cc.glBindTexture2DN(0, locTexture);

                var _bufferchanged = !gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer.vertexBuffer);
                // if (this._bufferDirty) {
                //     gl.bufferSubData(gl.ARRAY_BUFFER, this._bufferOffset, this._float32View);
                //     this._bufferDirty = false;
                // }
                if (_resetPointers || _bufferchanged) {
                    gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
                    gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
                    gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
                    gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 3, gl.FLOAT, false, 24, 0);
                    gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.UNSIGNED_BYTE, true, 24, 12);
                    gl.vertexAttribPointer(cc.VERTEX_ATTRIB_TEX_COORDS, 2, gl.FLOAT, false, 24, 16);
                    _resetPointers = false;
                }
                gl.drawArrays(gl.TRIANGLE_STRIP, this._bufferOffset / (this.vertexBytesPerUnit/4), 4);
            }
        } else {
            program.use();
            program._updateProjectionUniform();

            cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);

            gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer.vertexBuffer);
            // if (this._bufferDirty) {
            //     gl.bufferSubData(gl.ARRAY_BUFFER, this._bufferOffset, this._float32View);
            //     this._bufferDirty = false;
            // }
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_POSITION, 3, gl.FLOAT, false, 24, 0);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_COLOR, 4, gl.UNSIGNED_BYTE, true, 24, 12);
            gl.drawArrays(gl.TRIANGLE_STRIP, this._bufferOffset / (this.vertexBytesPerUnit/4), 4);
            _resetPointers = true;
        }
        cc.g_NumberOfDraws++;

        if (cc.SPRITE_DEBUG_DRAW === 0 && !node._showNode)
            return;

        cc.kmGLMatrixMode(cc.KM_GL_MODELVIEW);
        //cc.kmGLPushMatrixWitMat4(node._stackMatrix);
        cc.current_stack.stack.push(cc.current_stack.top);
        cc.current_stack.top = this._stackMatrix;

        if (cc.SPRITE_DEBUG_DRAW === 1 || node._showNode) {
            // draw bounding box
            var vertices = this._vertices;
            var verticesG1 = [
                cc.p(vertices[0].x, vertices[0].y),
                cc.p(vertices[2].x, vertices[2].y),
                cc.p(vertices[3].x, vertices[3].y),
                cc.p(vertices[1].x, vertices[1].y)
            ];
            cc._drawingUtil.drawPoly(verticesG1, 4, true);
        } else if (cc.SPRITE_DEBUG_DRAW === 2) {
            // draw texture box
            var drawRectG2 = node.getTextureRect();
            var offsetPixG2 = node.getOffsetPosition();
            var verticesG2 = [cc.p(offsetPixG2.x, offsetPixG2.y), cc.p(offsetPixG2.x + drawRectG2.width, offsetPixG2.y),
                cc.p(offsetPixG2.x + drawRectG2.width, offsetPixG2.y + drawRectG2.height), cc.p(offsetPixG2.x, offsetPixG2.y + drawRectG2.height)];
            cc._drawingUtil.drawPoly(verticesG2, 4, true);
        } // CC_SPRITE_DEBUG_DRAW
        cc.current_stack.top = cc.current_stack.stack.pop();
    };

    proto.batchVertexBuffer = function (f32buffer, int32buffer, vertexDataOffset) {
        // Fill in vertex data with quad information (4 vertices for sprite)
        var float32Data = this._float32View;
        var uint32Data = this._uint32View;
        var i, len = float32Data.length, colorId = 3;
        for (i = 0; i < len; ++i) {
            if (i === colorId) {
                int32buffer[vertexDataOffset + i] = uint32Data[i];
                // 6 data per index
                colorId += 6;
            }
            else {
                f32buffer[vertexDataOffset + i] = float32Data[i];
            }
        }
    };
})();