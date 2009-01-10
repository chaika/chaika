<?xml version="1.0"?>

<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:rss="http://purl.org/rss/1.0/"
	xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
	xmlns:str="http://exslt.org/strings">

	<xsl:output method="xml" indent="yes"/>

	<xsl:template match="/">
		<board>
			<xsl:for-each select="/rdf:RDF/rss:item">
				<thread url="{rss:link}" title="{rss:title}">
					<xsl:for-each select="str:tokenize(rss:description, ' - ')">
						<xsl:if test="position() = 1">
							<xsl:attribute name="lineCount">
								<xsl:value-of select="substring-before(., 'posts')" />
							</xsl:attribute>
						</xsl:if>
						<xsl:if test="position() = 2">
							<xsl:attribute name="host">
								<xsl:value-of select="." />
							</xsl:attribute>
						</xsl:if>
						<xsl:if test="position() = 3">
							<xsl:attribute name="category">
								<xsl:value-of select="." />
							</xsl:attribute>
						</xsl:if>
					</xsl:for-each>
				</thread>
				<xsl:text>&#x0A;</xsl:text>
			</xsl:for-each>
		</board>
	</xsl:template>

</xsl:stylesheet>