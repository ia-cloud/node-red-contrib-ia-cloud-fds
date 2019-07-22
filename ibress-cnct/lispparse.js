// File: lisp.js
//                        
// Author: Paul M. Parks
// Modified by: Andrew Thomas
// 
// Purpose: 
// An implementation of Lisp in JavaScript.
// 
// Comments: 
//
// Greenspun's Tenth Rule of Programming: "Any sufficiently complicated
// C or Fortran program contains an ad-hoc, informally-specified
// bug-ridden slow implementation of half of Common Lisp."
//
// I suppose we can add JavaScript to that list, now.
// 
// Contact:
// 
// paul@parkscomputing.com
// http://www.parkscomputing.com/
// 
// License:
// 
// Copyright (c) 2005, Paul M. Parks
// All Rights Reserved.
// 
// Redistribution and use in source and binary forms, with or without 
// modification, are permitted provided that the following conditions 
// are met:
// 
// * Redistributions of source code must retain the above copyright 
//   notice, this list of conditions and the following disclaimer.
// 
// * Redistributions in binary form must reproduce the above 
//   copyright notice, this list of conditions and the following 
//   disclaimer in the documentation and/or other materials provided 
//   with the distribution.
// 
// * Neither the name of Paul M. Parks nor the names of his 
//   contributors may be used to endorse or promote products derived 
//   from this software without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS 
// FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE 
// COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, 
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, 
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; 
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT 
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN 
// ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF 
// THE POSSIBILITY OF SUCH DAMAGE.
//


var Lisp = new Object();
module.exports = Lisp;

/*
 * This will tokenize a string for all LISP expressions within it.  The result
 * is an array of all top-level expressions.  Lists and sub-lists are stored
 * as array elements or their parents.
 *
 * Strings are preserved.  \n \r \t \f in strings are converted to their
 * appropriate white space.  \x where x is any other character produces x.
 * Numbers are converted to numbers.  Non-numbers are always strings.
 *
 * e.g., Process: (a "b \n \d \"c\"" (c d e)) f (g h)
 *	==> [ [ "a" "b \n d \"c\"" [ "c" "d" "e" ] ] "f" [ "g" "h" ] ]
 */

Lisp.tokenize = function(str, i, list)
{
   var ix = 0;
   var comment = false;
   var string = false;
   var escaped = false;
   var c = null;
   var nl = /\\n/g;
   var tab = /\\t/g;
   var retpat = /\\r/g;
   var ff = /\\f/g;

   var tokStart = i;

   function getToken(isString)
   {
      var token = null;
      
      if (tokStart < i || isString)
      {
         token = str.substring(tokStart, i);

         if (!isString && !isNaN(token))
         {
            list[ix++] = +token;
         }
         else
         {
	     if (token.indexOf('\\') != -1)
	     {
		 token = token.replace(nl,"\n")
	     	     .replace(retpat,"\r")
	     	     .replace(tab,"\t")
	     	     .replace(ff,"\f");
		 pat = /\\(.)/g;
		 token = token.replace(pat, "$1");
	     }
	    
             list[ix++] = token;
         }
      }
   };
   
   var fn = new Object();
   
   fn["("] = function() 
   {
      getToken();
      list[ix] = new Array();
      ++i;
      i = Lisp.tokenize(str, i, list[ix]);
      ++ix;
      tokStart = i;
      return false;
   };
   
   fn[")"] = function() 
   {
      getToken();
      ++i;
      return i;
   };
   
   fn[";"] = function() 
   {
      comment = true;
      ++i;
      tokStart = i;
      return false;
   };

   fn["\\"] = function()
   {
      escaped = true;
      ++i;
      return false;
   };
    
   fn["\""] = function() 
   {
      // list[ix++] = "'";
      string = true;
      ++i;
      tokStart = i;
      return false;
   };

   /*
   fn["'"] = fn["`"] = fn[","] = function() 
   {
      list[ix++] = str.charAt(i);
      ++i;
      tokStart = i;
      return false;
   };
   */
   
   fn[" "] = fn["\t"] = fn["\r"] = fn["\n"] = function() 
   {
      getToken();
      ++i;
      tokStart = i;
      return false;
   };

   while (i < str.length)
   {
      c = str.charAt(i);

      if (comment)
      {
         if (c == "\r" || c == "\n")
         {
            comment = false;
         }
         
         ++i;
         tokStart = i;
      }
      else if (string)
      {
	 if (escaped)
	 {
	     ++i;
	     escaped = false;
	 }
	 else if (c == "\\")
	 {
	     escaped = true;
	     ++i;
	 }
	 else if (c == "\"")
         {
            string = false;
            getToken(true);
            ++i;
            tokStart = i;
         }
         else
         {
            ++i;
         }
      }
      else
      {
         if (!escaped && fn[c])
         {
            var ret = fn[c]();
            
            if (ret)
            {
               return ret;
            }
         }
         else
         {
            ++i;
	    escaped = false;
         }
      }
   }
   
   getToken();
   return i;
};
