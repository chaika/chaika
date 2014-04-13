<?xml version="1.0"?>

<xsl:stylesheet version="1.0"
        xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
        xmlns:rss="http://purl.org/rss/1.0/"
        xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        xmlns:exslt="http://exslt.org/common"
        xmlns:set="http://exslt.org/sets"
        xmlns:str="http://exslt.org/strings">

    <xsl:output method="xml" indent="yes"/>


    <xsl:template match="/">
        <xsl:variable name="thread-set">
            <xsl:apply-templates select="/rdf:RDF/rss:item"/>
        </xsl:variable>

        <category>
            <xsl:for-each select="set:distinct(exslt:node-set($thread-set)/thread/@boardName)">
                <xsl:variable name="board-name" select="."/>
                <board title="{$board-name}" isContainer="true" isOpen="true">
                    <xsl:copy-of select="exslt:node-set($thread-set)/thread[@boardName=$board-name]"/>
                </board>
            </xsl:for-each>
        </category>
    </xsl:template>


    <xsl:template match="rss:item">
        <thread url="{rss:link}">
            <xsl:variable name="thread-title" select="rss:title"/>
            <xsl:for-each select="str:tokenize(rss:description, ' - ')">
                <xsl:if test="position() = 1">
                    <xsl:attribute name="title">
                        <xsl:value-of select="$thread-title"/>
                        <xsl:text>  [</xsl:text>
                        <xsl:value-of select="substring-before(., 'posts')"/>
                        <xsl:text>]</xsl:text>
                    </xsl:attribute>
                </xsl:if>
                <xsl:if test="position() = 3">
                    <xsl:attribute name="boardName">
                        <xsl:value-of select="."/>
                    </xsl:attribute>
                </xsl:if>
            </xsl:for-each>
        </thread>

    </xsl:template>


</xsl:stylesheet>
