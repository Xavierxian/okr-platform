import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const renderedLines: React.ReactNode[] = [];
    
    let listLevel = 0;
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 处理代码块
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // 结束代码块
          inCodeBlock = false;
          renderedLines.push(
            <View key={`code-${i}`} style={styles.codeBlock}>
              <Text style={styles.codeText}>{codeBlockContent.join('\n')}</Text>
            </View>
          );
          codeBlockContent = [];
        } else {
          // 开始代码块
          inCodeBlock = true;
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // 处理标题
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const title = line.replace(/^#+\s*/, '');
        
        switch (level) {
          case 1:
            renderedLines.push(
              <Text key={`h1-${i}`} style={[styles.heading, styles.h1]}>
                {title}
              </Text>
            );
            break;
          case 2:
            renderedLines.push(
              <Text key={`h2-${i}`} style={[styles.heading, styles.h2]}>
                {title}
              </Text>
            );
            break;
          case 3:
            renderedLines.push(
              <Text key={`h3-${i}`} style={[styles.heading, styles.h3]}>
                {title}
              </Text>
            );
            break;
          case 4:
            renderedLines.push(
              <Text key={`h4-${i}`} style={[styles.heading, styles.h4]}>
                {title}
              </Text>
            );
            break;
          default:
            renderedLines.push(
              <Text key={`h5-${i}`} style={[styles.heading, styles.h5]}>
                {title}
              </Text>
            );
        }
        continue;
      }

      // 处理列表
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('+ ')) {
        const listItem = line.trim().substring(2);
        renderedLines.push(
          <View key={`li-${i}`} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{listItem}</Text>
          </View>
        );
        continue;
      }

      // 处理数字列表
      if (/^\d+\.\s/.test(line.trim())) {
        const listItem = line.trim().replace(/^\d+\.\s/, '');
        const number = line.trim().match(/^\d+/)?.[0] || '';
        renderedLines.push(
          <View key={`oli-${i}`} style={styles.orderedListItem}>
            <Text style={styles.number}>{number}.</Text>
            <Text style={styles.listText}>{listItem}</Text>
          </View>
        );
        continue;
      }

      // 处理粗体文本
      if (line.includes('**') || line.includes('__')) {
        const parts = line.split(/(\*\*.*?\*\*|__.*?__)/);
        const boldParts = parts.map((part, index) => {
          if ((part.startsWith('**') && part.endsWith('**')) || 
              (part.startsWith('__') && part.endsWith('__'))) {
            const content = part.substring(2, part.length - 2);
            return (
              <Text key={`bold-${i}-${index}`} style={styles.bold}>
                {content}
              </Text>
            );
          }
          return part;
        });
        
        renderedLines.push(
          <Text key={`text-${i}`} style={styles.paragraph}>
            {boldParts}
          </Text>
        );
        continue;
      }

      // 处理斜体文本
      if (line.includes('*') || line.includes('_')) {
        const parts = line.split(/(\*.*?\*|_.*?_)/);
        const italicParts = parts.map((part, index) => {
          if ((part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) || 
              (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__'))) {
            const content = part.substring(1, part.length - 1);
            return (
              <Text key={`italic-${i}-${index}`} style={styles.italic}>
                {content}
              </Text>
            );
          }
          return part;
        });
        
        renderedLines.push(
          <Text key={`text-${i}`} style={styles.paragraph}>
            {italicParts}
          </Text>
        );
        continue;
      }

      // 普通段落
      if (line.trim()) {
        renderedLines.push(
          <Text key={`p-${i}`} style={styles.paragraph}>
            {line}
          </Text>
        );
      } else {
        // 空行
        renderedLines.push(<View key={`br-${i}`} style={styles.lineBreak} />);
      }
    }

    return renderedLines;
  };

  return <View style={styles.container}>{renderMarkdown(content)}</View>;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  heading: {
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
    marginTop: 16,
  },
  h1: {
    fontSize: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  h2: {
    fontSize: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '80',
    paddingBottom: 6,
  },
  h3: {
    fontSize: 18,
    color: Colors.primary,
  },
  h4: {
    fontSize: 16,
    color: Colors.accent,
  },
  h5: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  paragraph: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  bold: {
    fontWeight: 'bold',
    color: Colors.text,
  },
  italic: {
    fontStyle: 'italic',
    color: Colors.text,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 16,
  },
  orderedListItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 16,
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    color: Colors.primary,
  },
  number: {
    fontSize: 14,
    marginRight: 8,
    color: Colors.primary,
    minWidth: 20,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  lineBreak: {
    height: 8,
  },
  codeBlock: {
    backgroundColor: Colors.background,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: 12,
    marginVertical: 8,
    borderRadius: 4,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});