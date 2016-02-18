/* See license.txt for terms of usage */

var Trip = {

    getTrip: function Trip_getTrip(aTripKey){
        var uniConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                            .createInstance(Ci.nsIScriptableUnicodeConverter);
        uniConverter.charset = 'Shift_JIS';

        var tripKey = uniConverter.convertToByteArray(aTripKey, {}).map((charCode) => {
            return String.fromCharCode(charCode);
        }).join("");

        // #以降が12文字以上なら新形式
        // http://qb5.2ch.net/test/read.cgi/operate/1244993904/309n
        if(tripKey.length >= 13){
            // crypt(DES) の キーと salt を直接指定
            // ##xxxxxxxxxxxxxxxxnn
            // xx = 16進文字列(8byte), nn = salt(2文字以下なら "." で埋める)
            let directTripReg = /^##([A-Fa-f0-9]{16})([\./A-Za-z0-9]{0,2})$/;
            if(directTripReg.test(tripKey)){
                return this.getDirectTrip(tripKey);
            }

            // #$ や直接指定の ## 以外のトリップキーは将来の拡張に予約されている
            if(tripKey[1] === "$" || tripKey[1] === "#"){
                return "???";
            }

            // 新12文字トリップ
            // SHA-1 を Base64 に変換した値の先頭12文字("+"は"."に置換される)
            return this.getSHA1Trip(tripKey);
        }else{
            // 従来の形式
            return this.getOldTrip(tripKey);
        }
    },


    getSHA1Trip: function Trip_getSHA1Trip(aTripKey){
        var tripKey = aTripKey.substring(1);
        var data = Array.map(tripKey, function(aElement, aIndex, aArray){
            return aElement.charCodeAt(0);
        });

         var cryptoHash = Cc["@mozilla.org/security/hash;1"]
                .createInstance(Ci.nsICryptoHash);
        cryptoHash.init(Ci.nsICryptoHash.SHA1);
        cryptoHash.update(data, data.length);

        return cryptoHash.finish(true).substring(0,12).replace(/\+/g, ".");
    },


    getDirectTrip: function Trip_getDirectTrip(aTripKey){
        var tripKey = aTripKey.substring(2);
        var salt = (tripKey + "..").substring(16, 18);

        var key = "";
        for(var i=0; i<16; i+=2){
            key += String.fromCharCode(parseInt(tripKey[i] + tripKey[i+1], 16));
        }

        return DESCrypt.crypt(key, salt).substr(-10);
    },


    getOldTrip: function Trip_getOldTrip(aTripKey){
        const REPLACE_CHAR_LIST = ":;<=>?@[\\]^_`".split("");
        const REPLACE_CHAR_RESULT_LIST = "ABCDEFGabcdef".split("");

        var tripKey = aTripKey.substring(1);
        var salt = (tripKey + "H.").substring(1,3).replace(/[^\.-z]/g, ".");
        salt = Array.map(salt, function(aElement, aIndex, aArray){
            var i = REPLACE_CHAR_LIST.indexOf(aElement);
            if(i != -1) return REPLACE_CHAR_RESULT_LIST[i];
            return aElement;
        }).join("");

        return DESCrypt.crypt(tripKey, salt).substr(-10);
    }

};




var DESCrypt = {

    PC1: [
        56, 48, 40, 32, 24, 16,  8,  0,
        57, 49, 41, 33, 25, 17,  9,  1,
        58, 50, 42, 34, 26, 18, 10,  2,
        59, 51, 43, 35, 62, 54, 46, 38,
        30, 22, 14,  6, 61, 53, 45, 37,
        29, 21, 13,  5, 60, 52, 44, 36,
        28, 20, 12,  4, 27, 19, 11,  3
    ],


    PC2: [
        13, 16, 10, 23,  0,  4,  2, 27,
        14,  5, 20,  9, 22, 18, 11,  3,
        25,  7,    15,  6, 26, 19, 12,  1,
        40, 51, 30, 36, 46, 54, 29, 39,
        50, 44, 32, 47, 43, 48, 38, 55,
        33, 52, 45, 41, 49, 35, 28, 31,
    ],


    SHIFT: [ 1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1 ],


    IP: [
        57, 49, 41, 33, 25, 17,  9,  1,
        59, 51, 43, 35, 27, 19, 11,  3,
        61, 53, 45, 37, 29, 21, 13,  5,
        63, 55, 47, 39, 31, 23, 15,  7,
        56, 48, 40, 32, 24, 16,  8,  0,
        58, 50, 42, 34, 26, 18, 10,  2,
        60, 52, 44, 36, 28, 20, 12,  4,
        62, 54, 46, 38, 30, 22, 14,  6
    ],


    E2: [
        31,  0,  1,  2,  3,  4,  3,  4,
         5,  6,  7,  8,  7,  8,  9, 10,
        11, 12, 11, 12, 13, 14, 15, 16,
        15, 16, 17, 18, 19, 20, 19, 20,
        21, 22, 23, 24, 23, 24, 25, 26,
        27, 28, 27, 28, 29, 30, 31,  0
    ],


    SBOX: [
        [
            14,  4, 13,  1,  2, 15, 11,  8,
             3, 10,  6, 12,  5,  9,  0,  7,
             0, 15,  7,  4, 14,  2, 13,  1,
            10,  6, 12, 11,  9,  5,  3,  8,
             4,  1, 14,  8, 13,  6,  2, 11,
            15, 12,  9,  7,  3, 10,  5,  0,
            15, 12,  8,  2,  4,  9,  1,  7,
             5, 11,  3, 14, 10,  0,  6, 13
        ],
        [
            15,  1,  8, 14,  6, 11,  3,  4,
             9,  7,  2, 13, 12,  0,  5, 10,
             3, 13,  4,  7, 15,  2,  8, 14,
            12,  0,  1, 10,  6,  9, 11,  5,
             0, 14,  7, 11, 10,  4, 13,  1,
             5,  8, 12,  6,  9,  3,  2, 15,
            13,  8, 10,  1,  3, 15,  4,  2,
            11,  6,  7, 12,  0,  5, 14,  9
        ],
        [
            10,  0,  9, 14,  6,  3, 15,  5,
             1, 13, 12,  7, 11,  4,  2,  8,
            13,  7,  0,  9,  3,  4,  6, 10,
             2,  8,  5, 14, 12, 11, 15,  1,
            13,  6,  4,  9,  8, 15,  3,  0,
            11,  1,  2, 12,  5, 10, 14,  7,
             1, 10, 13,  0,  6,  9,  8,  7,
             4, 15, 14,  3, 11,  5,  2, 12
        ],
        [
             7, 13, 14,  3,  0,  6,  9, 10,
             1,  2,  8,  5, 11, 12,  4, 15,
            13,  8, 11,  5,  6, 15,  0,  3,
             4,  7,  2, 12,  1, 10, 14,  9,
            10,  6,  9,  0, 12, 11,  7, 13,
            15,  1,  3, 14,  5,  2,  8,  4,
             3, 15,  0,  6, 10,  1, 13,  8,
             9,  4,  5, 11, 12,  7,  2, 14
        ],
        [
             2, 12,  4,  1,  7, 10, 11,  6,
             8,  5,  3, 15, 13,  0, 14,  9,
            14, 11,  2, 12,  4,  7, 13,  1,
             5,  0, 15, 10,  3,  9,  8,  6,
             4,  2,  1, 11, 10, 13,  7,  8,
            15,  9, 12,  5,  6,  3,  0, 14,
            11,  8, 12,  7,  1, 14,  2, 13,
             6, 15,  0,  9, 10,  4,  5,  3
        ],
        [
            12,  1, 10, 15,  9,  2,  6,  8,
             0, 13,  3,  4, 14,  7,  5, 11,
            10, 15,  4,  2,  7, 12,  9,  5,
             6,  1, 13, 14,  0, 11,  3,  8,
             9, 14, 15,  5,  2,  8, 12,  3,
             7,  0,  4, 10,  1, 13, 11,  6,
             4,  3,  2, 12,  9,  5, 15, 10,
            11, 14,  1,  7,  6,  0,  8, 13
        ],
        [
             4, 11,  2, 14, 15,  0,  8, 13,
             3, 12,  9,  7,  5, 10,  6,  1,
            13,  0, 11,  7,  4,  9,  1, 10,
            14,  3,  5, 12,  2, 15,  8,  6,
             1,  4, 11, 13, 12,  3,  7, 14,
            10, 15,  6,  8,  0,  5,  9,  2,
             6, 11, 13,  8,  1,  4, 10,  7,
             9,  5,  0, 15, 14,  2,  3, 12
        ],
        [
            13,  2,  8,  4,  6, 15, 11,  1,
            10,  9,  3, 14,  5,  0, 12,  7,
             1, 15, 13,  8, 10,  3,  7,  4,
            12,  5,  6, 11,  0, 14,  9,  2,
             7, 11,  4,  1,  9, 12, 14,  2,
             0,  6, 10, 13, 15,  3,  5,  8,
             2,  1, 14,  7,  4, 10,  8, 13,
            15, 12,  9,  0,  3,  5,  6, 11
        ]
    ],


    P: [
        15,  6, 19, 20, 28, 11, 27, 16,
         0, 14, 22, 25,  4, 17, 30,  9,
         1,  7, 23, 13, 31, 26,  2,  8,
        18, 12, 29,  5, 21, 10,  3, 24
    ],


    FP: [
        40,  8, 48, 16, 56, 24, 64, 32,
        39,  7, 47, 15, 55, 23, 63, 31,
        38,  6, 46, 14, 54, 22, 62, 30,
        37,  5, 45, 13, 53, 21, 61, 29,
        36,  4, 44, 12, 52, 20, 60, 28,
        35,  3, 43, 11, 51, 19, 59, 27,
        34,  2, 42, 10, 50, 18, 58, 26,
        33,  1, 41,  9, 49, 17, 57, 25
    ],


    CHAR_LIST: "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",


    crypt: function DESCrypt_crypt(aStr, aSalt){
        var str = aStr.substring(0, 8);
        var salt = aSalt.substring(0, 2);

        var data = new Array(64);

        for(var i=0; i<64; i++){
            data[i] = 0;
        }

        var e = this.E2.slice(0);
        for(var i=0; i < 2; i++){
            var c = this.CHAR_LIST.indexOf(salt[i]);

            for(j=0; j < 6; j++){
                if((c >> j) & 01){
                    var k = e[6*i+j];
                    e[6*i+j] = e[6*i+j+24];
                    e[6*i+j+24] = k;
                }
            }
        }

        var keys = this.createKeys(str);

        for(var m=0;m < 25; m++){

            data = this.IP.map(function(aElement, aIndex, aArray){
                return data[aElement];
            })

            var left = data.slice(0, 32);
            var right = data.slice(32);

            for(var i=0; i<16; i++){
                var tmpRight = right.slice(0);
                right = e.map(function(aElement, aIndex, aArray){
                    return right[aElement];
                })

                var key = keys[i];
                var tmpData = right.map(function(aElement, aIndex, aArray){
                    return aElement ^ key[aIndex];
                })

                data = [];
                for(var j=0; j<8; j++){
                    var b1 = tmpData.slice(j*6, j*6+6);
                    var b2 = parseInt(b1[0] +""+ b1[5], 2);
                    var b3 = parseInt(b1[1] +""+ b1[2] +""+ b1[3] +""+ b1[4], 2);
                    var s = this.SBOX[j][b2*16 + b3];
                    data = data.concat(this._getBit(s, 4));
                }

                data = this.P.map(function(aElement, aIndex, aArray){
                    return data[aElement];
                })

                right = left.map(function(aElement, aIndex, aArray){
                    return aElement ^ data[aIndex];
                })

                left = tmpRight.slice(0);
            }

            data = right.concat(left);
            data = this.FP.map(function(aElement, aIndex, aArray){
                return data[aElement - 1];
            })
        }

        data.push(0);
        data.push(0);

        var result = salt;
        for(i=0; i < 11; i++){
            var c = 0;
            for(var j=0; j < 6; j++){
                c <<= 1;
                c |= (data[6*i+j]);
            }
            result += this.CHAR_LIST[c];
        }

        return result;
    },


    createKeys: function DESCrypt_createKeys(aStr){
        var data = [];
        for(var i=0; i<8; i++){
            var c = (aStr.charCodeAt(i) & 127) << 1;
            data = data.concat(this._getBit(c, 8));
        }
        var keys = [16];

        var key = this.PC1.map(function(aElement, aIndex, aArray){
            return data[aElement] || 0;
        });
        var c = key.slice(0, 28);
        var d = key.slice(28);

        for(var i=0; i<16; i++){
            var shiftCount = this.SHIFT[i];
            for(var j=0; j<shiftCount; j++){
                var tempC = c.shift();
                c.push(tempC);
                var tempD = d.shift();
                d.push(tempD);
            }
            key = c.concat(d);
            keys[i] = this.PC2.map(function(aElement, aIndex, aArray){
                return key[aElement];
            });
        }
        return keys;
    },


    _getBit: function DESCrypt__getBit(aNumber, aBit){
        var n = aNumber;
        var r = new Array(aBit - 1);
        for(var i=r.length; i>=0; i--){
            r[i] = n & 1;
            n >>>= 1;
        }
        return r;
    }

};
